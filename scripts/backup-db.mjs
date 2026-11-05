import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// A dead connection must fail (and be retried), never hang: the previous
// toArray()-based version sat for 20 hours on one stalled socket.
const SOCKET_TIMEOUT_MS = 120_000;
const SERVER_SELECTION_TIMEOUT_MS = 30_000;
const BATCH_SIZE = 500;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5_000;
const REDRAW_INTERVAL_MS = 250;
const BAR_WIDTH = 30;

// Minimal .env parser — avoids adding a dotenv dependency for a one-off script.
function loadEnv(envPath) {
    if (!fs.existsSync(envPath)) return;
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eq = trimmed.indexOf("=");
        if (eq === -1) continue;
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = value;
    }
}

loadEnv(path.join(rootDir, ".env"));

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error("MONGODB_URI not found in .env");
    process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
// BACKUP_ROOT lets the backup land on another drive when this one is full.
const backupRoot = process.env.BACKUP_ROOT
    ? path.resolve(process.env.BACKUP_ROOT)
    : path.join(rootDir, "db-backups");
const outDir = path.join(backupRoot, timestamp);
fs.mkdirSync(outDir, { recursive: true });

// Plain-text log next to the backup, so progress can be followed from
// another terminal (or after the fact) as well as in this window.
const logPath = path.join(outDir, "backup.log");
const isTty = Boolean(process.stdout.isTTY);

function log(message) {
    const line = `[${new Date().toLocaleTimeString()}] ${message}`;
    fs.appendFileSync(logPath, line + "\n");
    if (isTty) process.stdout.write("\r\x1b[2K");
    console.log(line);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatMb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function formatDuration(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "--";
    const s = Math.round(seconds);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

function bar(fraction) {
    const clamped = Math.min(1, Math.max(0, fraction));
    const filled = Math.round(clamped * BAR_WIDTH);
    return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
}

/**
 * Shared progress state. Overall progress is measured in documents (counts
 * are known up front); speed and ETA come from that same document rate.
 */
function createProgress(totalDocs, collectionCount) {
    const state = {
        totalDocs,
        collectionCount,
        doneDocs: 0,
        bytes: 0,
        startedAt: Date.now(),
        current: null, // { name, index, docs, total }
        lastLogPct: -1,
    };

    function render() {
        const elapsed = (Date.now() - state.startedAt) / 1000;
        const fraction = state.totalDocs ? state.doneDocs / state.totalDocs : 1;
        const docRate = elapsed > 0 ? state.doneDocs / elapsed : 0;
        const eta = docRate > 0 ? (state.totalDocs - state.doneDocs) / docRate : Infinity;
        const speed = elapsed > 0 ? state.bytes / elapsed / 1024 : 0;
        const cur = state.current;
        const curText = cur
            ? `[${cur.index}/${state.collectionCount}] ${cur.name} ${cur.docs.toLocaleString()}/${cur.total.toLocaleString()}`
            : "";
        return `${bar(fraction)} ${(fraction * 100).toFixed(1).padStart(5)}%  ${curText}  ${formatMb(state.bytes)}  ${speed.toFixed(0)} KB/s  elapsed ${formatDuration(elapsed)}  ETA ${formatDuration(eta)}`;
    }

    function draw() {
        if (isTty) {
            process.stdout.write("\r\x1b[2K" + render());
            return;
        }
        // Non-interactive output: one line per 5% instead of a live bar.
        const pct = Math.floor((state.doneDocs / Math.max(1, state.totalDocs)) * 20) * 5;
        if (pct > state.lastLogPct) {
            state.lastLogPct = pct;
            console.log(render());
        }
    }

    return { state, draw, render };
}

/**
 * Streams one collection into <name>.json, byte-for-byte the same layout as
 * JSON.stringify(docs, null, 2), so existing consumers keep working.
 */
async function dumpCollection(db, name, progress) {
    const filePath = path.join(outDir, `${name}.json`);
    const tmpPath = `${filePath}.partial`;
    const out = fs.openSync(tmpPath, "w");
    let docs = 0;
    let bytes = 0;
    const write = (text) => {
        fs.writeSync(out, text);
        bytes += Buffer.byteLength(text);
        progress.state.bytes += Buffer.byteLength(text);
    };

    try {
        const cursor = db.collection(name).find({}, { batchSize: BATCH_SIZE });
        let lastDraw = 0;
        for await (const doc of cursor) {
            // Indent each element exactly as the whole-array stringify would.
            const element = JSON.stringify([doc], null, 2).slice(2, -2);
            write(docs === 0 ? "[\n" + element : ",\n" + element);
            docs += 1;
            progress.state.current.docs = docs;
            progress.state.doneDocs += 1;
            if (Date.now() - lastDraw > REDRAW_INTERVAL_MS) {
                lastDraw = Date.now();
                progress.draw();
            }
        }
        write(docs === 0 ? "[]" : "\n]");
        fs.closeSync(out);
        fs.renameSync(tmpPath, filePath);
        return { docs, bytes };
    } catch (err) {
        fs.closeSync(out);
        fs.rmSync(tmpPath, { force: true });
        // Undo this attempt's contribution so a retry doesn't double count.
        progress.state.doneDocs -= docs;
        progress.state.bytes -= bytes;
        throw err;
    }
}

async function dumpWithRetry(db, name, progress) {
    for (let attempt = 1; ; attempt += 1) {
        try {
            return await dumpCollection(db, name, progress);
        } catch (err) {
            if (attempt >= MAX_ATTEMPTS) throw err;
            log(`  ${name}: attempt ${attempt} failed (${err.message}) — retrying in ${RETRY_DELAY_MS / 1000}s`);
            await sleep(RETRY_DELAY_MS);
        }
    }
}

async function main() {
    log(`Backup folder: ${path.relative(rootDir, outDir)}`);
    log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI, {
        socketTimeoutMS: SOCKET_TIMEOUT_MS,
        serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
    });
    const db = mongoose.connection.db;
    log(`Connected to database: ${db.databaseName}`);

    const collections = await db.listCollections().toArray();
    const counts = await Promise.all(
        collections.map(({ name }) => db.collection(name).estimatedDocumentCount())
    );
    const totalDocs = counts.reduce((sum, n) => sum + n, 0);
    log(`Found ${collections.length} collections, ~${totalDocs.toLocaleString()} documents.`);

    const progress = createProgress(totalDocs, collections.length);
    const manifest = { timestamp, database: db.databaseName, collections: {} };

    for (const [i, { name }] of collections.entries()) {
        progress.state.current = { name, index: i + 1, docs: 0, total: counts[i] };
        progress.draw();
        const started = Date.now();
        const { docs, bytes } = await dumpWithRetry(db, name, progress);
        manifest.collections[name] = docs;
        log(`  ✔ [${i + 1}/${collections.length}] ${name}: ${docs.toLocaleString()} docs, ${formatMb(bytes)} in ${formatDuration((Date.now() - started) / 1000)}`);
        progress.draw();
    }

    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    progress.state.current = null;
    log(`Backup complete: ${path.relative(rootDir, outDir)}`);
    log(`Total: ${collections.length} collections, ${progress.state.doneDocs.toLocaleString()} docs, ${formatMb(progress.state.bytes)} in ${formatDuration((Date.now() - progress.state.startedAt) / 1000)}`);

    await mongoose.disconnect();
}

main().catch(async (err) => {
    log(`Backup FAILED: ${err.stack || err.message}`);
    process.exitCode = 1;
    await mongoose.disconnect().catch(() => {});
});
