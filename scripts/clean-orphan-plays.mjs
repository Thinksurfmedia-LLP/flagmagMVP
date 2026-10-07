// Removes plays and game-stats whose Game no longer exists.
//
// Deleting a schedule used to delete its games but leave their plays behind.
// Those orphans are invisible to every stats page (stats are computed per
// existing game) but still carry player ids, which makes "delete player"
// refuse with "has N recorded plays".
//
// Safety: dry run by default. --apply first writes every document it is about
// to delete to db-backups/manual/<timestamp>-orphan-plays-cleanup.json, then
// deletes only documents whose `game` id has no matching Game.
//
// Usage:
//   node scripts/clean-orphan-plays.mjs          # dry run
//   node scripts/clean-orphan-plays.mjs --apply  # backup, then delete

import fs from "fs";
import path from "path";
import mongoose from "mongoose";

function loadMongoUri() {
    if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
    for (const envFile of [".env.local", ".env"]) {
        if (!fs.existsSync(envFile)) continue;
        const line = fs.readFileSync(envFile, "utf8").split("\n").find((l) => l.startsWith("MONGODB_URI="));
        if (line) return line.slice("MONGODB_URI=".length).trim().replace(/^["']|["']$/g, "");
    }
    throw new Error("MONGODB_URI not found in environment, .env.local, or .env");
}

const apply = process.argv.includes("--apply");

async function findOrphanGameIds(db, collectionName, liveGameIds) {
    const gameIds = await db.collection(collectionName).distinct("game");
    return gameIds.filter((id) => !liveGameIds.has(String(id)));
}

async function main() {
    await mongoose.connect(loadMongoUri());
    const db = mongoose.connection.db;

    const liveGameIds = new Set(
        (await db.collection("games").find({}).project({ _id: 1 }).toArray()).map((g) => String(g._id))
    );

    const targets = [];
    for (const name of ["plays", "gamestats"]) {
        const orphanGameIds = await findOrphanGameIds(db, name, liveGameIds);
        const filter = { game: { $in: orphanGameIds } };
        const docs = orphanGameIds.length ? await db.collection(name).find(filter).toArray() : [];
        targets.push({ name, filter, orphanGameIds, docs });
        console.log(`${name}: ${docs.length} orphaned documents across ${orphanGameIds.length} missing games`);
    }

    const total = targets.reduce((n, t) => n + t.docs.length, 0);
    if (total === 0) {
        console.log("Nothing to clean.");
    } else if (!apply) {
        console.log("\nDry run — nothing changed. Re-run with --apply to back up and delete.");
    } else {
        const dir = path.resolve("db-backups", "manual");
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-orphan-plays-cleanup.json`);
        fs.writeFileSync(file, JSON.stringify(Object.fromEntries(targets.map((t) => [t.name, t.docs])), null, 2));
        console.log(`\nBacked up ${total} documents to ${file}`);

        for (const t of targets) {
            if (!t.docs.length) continue;
            const res = await db.collection(t.name).deleteMany(t.filter);
            console.log(`Deleted ${res.deletedCount} from ${t.name}`);
        }
    }
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error("[clean-orphan-plays] Failed:", err);
    process.exit(1);
});
