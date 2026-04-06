/**
 * One-shot backup script — dumps critical collections to JSON files.
 * Run: node scripts/backup.mjs
 * Output: scripts/backup-<timestamp>/
 */

import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MONGODB_URI =
    process.env.MONGODB_URI ||
    "mongodb+srv://flagmag:TrdCmZa3RW6jagEI@cluster0.uzopg7p.mongodb.net/database?appName=Cluster0";

const COLLECTIONS = [
    "games",
    "gamestats",
    "plays",
    "teams",
    "leagues",
    "seasons",
    "players",
    "organizations",
    "locations",
];

async function backup() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.\n");

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const outDir = path.join(__dirname, `backup-${timestamp}`);
    fs.mkdirSync(outDir, { recursive: true });

    const db = mongoose.connection.db;
    let totalDocs = 0;

    for (const name of COLLECTIONS) {
        try {
            const docs = await db.collection(name).find({}).toArray();
            const filePath = path.join(outDir, `${name}.json`);
            fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), "utf8");
            console.log(`  ✓  ${name.padEnd(16)} ${docs.length} documents  →  ${filePath}`);
            totalDocs += docs.length;
        } catch (err) {
            console.warn(`  ✗  ${name}: ${err.message}`);
        }
    }

    await mongoose.disconnect();
    console.log(`\nBackup complete. ${totalDocs} total documents saved to:\n  ${outDir}\n`);
}

backup().catch((err) => {
    console.error("Backup failed:", err);
    process.exit(1);
});
