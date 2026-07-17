import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

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
const outDir = path.join(rootDir, "db-backups", timestamp);
fs.mkdirSync(outDir, { recursive: true });

async function main() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    console.log(`Connected to database: ${db.databaseName}`);

    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections.`);

    const manifest = { timestamp, database: db.databaseName, collections: {} };

    for (const { name } of collections) {
        const docs = await db.collection(name).find({}).toArray();
        const filePath = path.join(outDir, `${name}.json`);
        fs.writeFileSync(filePath, JSON.stringify(docs, null, 2));
        manifest.collections[name] = docs.length;
        console.log(`  ${name}: ${docs.length} documents -> ${path.relative(rootDir, filePath)}`);
    }

    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    console.log(`\nBackup complete: ${path.relative(rootDir, outDir)}`);
    console.log(`Total collections: ${collections.length}`);

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error("Backup failed:", err);
    process.exitCode = 1;
});
