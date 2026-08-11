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
const baseOutDir = path.join(rootDir, "db-backups", "by-org", timestamp);

function safeFolderName(name) {
    return String(name).trim().replace(/[^a-z0-9-_]+/gi, "_");
}

function writeCollectionJson(outDir, collectionName, docs) {
    fs.writeFileSync(path.join(outDir, `${collectionName}.json`), JSON.stringify(docs, null, 2));
    return docs.length;
}

async function backupOrg(db, org) {
    const orgId = org._id;
    const outDir = path.join(baseOutDir, `${safeFolderName(org.name)}-${orgId.toString()}`);
    fs.mkdirSync(outDir, { recursive: true });

    const manifest = { organization: { _id: orgId.toString(), name: org.name }, timestamp, collections: {} };

    // ── Leagues owned by this org ────────────────────────────────────
    const leagues = await db.collection("leagues").find({ organization: orgId }).toArray();
    const liveLeagueIds = leagues.map(l => l._id);

    // ── Teams owned by this org ──────────────────────────────────────
    const teams = await db.collection("teams").find({ organization: orgId }).toArray();

    // Some teams/schedules may still reference a league id that no longer
    // exists (deleted League doc, dangling FK) — pull those in too so games
    // tied to an orphaned league aren't silently dropped from the backup.
    const teamLeagueRefs = new Set();
    teams.forEach(t => (t.leagues || []).forEach(m => m.league && teamLeagueRefs.add(m.league.toString())));

    // ── Schedules owned by this org ──────────────────────────────────
    const schedules = await db.collection("schedules").find({ organization: orgId }).toArray();
    const scheduleLeagueRefs = new Set(schedules.filter(s => s.leagueId).map(s => s.leagueId.toString()));

    const allLeagueIds = [...new Set([...liveLeagueIds.map(String), ...teamLeagueRefs, ...scheduleLeagueRefs])]
        .map(id => new mongoose.Types.ObjectId(id));

    // ── Games in any of those leagues (live or orphaned) ─────────────
    const games = await db.collection("games").find({ league: { $in: allLeagueIds } }).toArray();
    const gameIds = games.map(g => g._id);

    // ── Plays / GameStats tied to those games ────────────────────────
    const plays = await db.collection("plays").find({ game: { $in: gameIds } }).toArray();
    const gamestats = await db.collection("gamestats").find({ game: { $in: gameIds } }).toArray();

    // ── Seasons referenced by this org's leagues ─────────────────────
    const seasonIds = [...new Set(leagues.filter(l => l.season).map(l => l.season.toString()))]
        .map(id => new mongoose.Types.ObjectId(id));
    const seasons = await db.collection("seasons").find({ _id: { $in: seasonIds } }).toArray();

    // ── Players owned by this org ─────────────────────────────────────
    const players = await db.collection("players").find({ organization: orgId }).toArray();
    const playerUserIds = players.filter(p => p.user).map(p => p.user.toString());

    // ── Awards for those players ──────────────────────────────────────
    const awards = await db.collection("awards").find({
        player: { $in: players.map(p => p._id) },
    }).toArray();

    // ── Users: direct org ref + any user backing a player in this org ─
    const userIds = new Set(playerUserIds);
    const orgUsers = await db.collection("users").find({ organization: orgId }).toArray();
    orgUsers.forEach(u => userIds.add(u._id.toString()));
    const users = await db.collection("users").find({
        _id: { $in: [...userIds].map(id => new mongoose.Types.ObjectId(id)) },
    }).toArray();

    // ── Activities logged against this org ────────────────────────────
    const activities = await db.collection("activities").find({ organization: orgId }).toArray();

    manifest.collections.organizations = writeCollectionJson(outDir, "organizations", [org]);
    manifest.collections.leagues = writeCollectionJson(outDir, "leagues", leagues);
    manifest.collections.seasons = writeCollectionJson(outDir, "seasons", seasons);
    manifest.collections.teams = writeCollectionJson(outDir, "teams", teams);
    manifest.collections.games = writeCollectionJson(outDir, "games", games);
    manifest.collections.schedules = writeCollectionJson(outDir, "schedules", schedules);
    manifest.collections.plays = writeCollectionJson(outDir, "plays", plays);
    manifest.collections.gamestats = writeCollectionJson(outDir, "gamestats", gamestats);
    manifest.collections.players = writeCollectionJson(outDir, "players", players);
    manifest.collections.awards = writeCollectionJson(outDir, "awards", awards);
    manifest.collections.users = writeCollectionJson(outDir, "users", users);
    manifest.collections.activities = writeCollectionJson(outDir, "activities", activities);

    manifest.orphanedLeagueRefs = allLeagueIds
        .map(id => id.toString())
        .filter(id => !liveLeagueIds.map(String).includes(id));

    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

    return { outDir, manifest };
}

async function backupShared(db) {
    // Reference data not owned by any single organization — dumped once,
    // shared across every org's restore.
    const outDir = path.join(baseOutDir, "_shared");
    fs.mkdirSync(outDir, { recursive: true });

    const sharedCollections = ["states", "counties", "venues", "amenities", "sitesettings", "roles", "cmscontents", "demorequests", "notifications"];
    const manifest = { timestamp, collections: {} };

    for (const name of sharedCollections) {
        const docs = await db.collection(name).find({}).toArray();
        manifest.collections[name] = writeCollectionJson(outDir, name, docs);
    }

    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    return { outDir, manifest };
}

async function main() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    console.log(`Connected to database: ${db.databaseName}\n`);

    const organizations = await db.collection("organizations").find({}).toArray();
    console.log(`Found ${organizations.length} organizations.\n`);

    const summary = [];

    for (const org of organizations) {
        console.log(`Backing up organization: ${org.name} (${org._id})`);
        const { outDir, manifest } = await backupOrg(db, org);
        console.log(`  -> ${path.relative(rootDir, outDir)}`);
        Object.entries(manifest.collections).forEach(([name, count]) => {
            console.log(`     ${name}: ${count}`);
        });
        if (manifest.orphanedLeagueRefs.length) {
            console.log(`     ⚠ orphaned league refs included: ${manifest.orphanedLeagueRefs.join(", ")}`);
        }
        summary.push({ organization: org.name, _id: org._id.toString(), outDir: path.relative(rootDir, outDir), collections: manifest.collections });
        console.log("");
    }

    console.log("Backing up shared/global reference data...");
    const { outDir: sharedDir, manifest: sharedManifest } = await backupShared(db);
    console.log(`  -> ${path.relative(rootDir, sharedDir)}`);
    Object.entries(sharedManifest.collections).forEach(([name, count]) => {
        console.log(`     ${name}: ${count}`);
    });

    fs.writeFileSync(
        path.join(baseOutDir, "index.json"),
        JSON.stringify({ timestamp, organizations: summary, shared: path.relative(rootDir, sharedDir) }, null, 2)
    );

    console.log(`\nAll organization backups complete: ${path.relative(rootDir, baseOutDir)}`);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error("Backup failed:", err);
    process.exitCode = 1;
});
