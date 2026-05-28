/**
 * Fix null scores caused by the schedule save bug.
 *
 * For each Game that has score: null on both teams but status: "completed",
 * we can't recover the real scores from code — this script just reports them
 * so the admin knows which games need manual score entry.
 *
 * If you have a backup, run this with RESTORE=1 and point BACKUP_FILE to a
 * JSON array of game objects (from scripts/backup-*\/games.json).
 *
 * Usage:
 *   node scripts/fix-null-scores.mjs                        (report only)
 *   RESTORE=1 BACKUP_FILE=scripts/backup-.../games.json node scripts/fix-null-scores.mjs
 */

import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env manually
try {
    const lines = readFileSync(resolve(process.cwd(), ".env"), "utf8").split("\n");
    for (const line of lines) {
        const match = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/);
        if (match) {
            const key = match[1];
            const val = match[2].replace(/^["']|["']$/g, "");
            if (!process.env[key]) process.env[key] = val;
        }
    }
} catch { /* no .env */ }

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/flagmag";
const RESTORE = process.env.RESTORE === "1";
const BACKUP_FILE = process.env.BACKUP_FILE || "";
const FORCE = process.env.FORCE === "1"; // overwrite even if score is already non-null

const GameSchema = new mongoose.Schema({
    league: mongoose.Schema.Types.ObjectId,
    date: Date,
    time: String,
    teamA: { name: String, logo: String, score: { type: Number, default: null } },
    teamB: { name: String, logo: String, score: { type: Number, default: null } },
    location: String,
    status: String,
    gameType: String,
}, { timestamps: true });

async function main() {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.\n");

    const Game = mongoose.model("Game", GameSchema);

    if (RESTORE && BACKUP_FILE) {
        // Restore scores from backup
        const backupPath = resolve(process.cwd(), BACKUP_FILE);
        const backupGames = JSON.parse(readFileSync(backupPath, "utf8"));
        console.log(`Loaded ${backupGames.length} games from backup.`);

        let restored = 0;
        let skipped = 0;
        for (const bg of backupGames) {
            const id = bg._id?.$oid || bg._id;
            const scoreA = bg.teamA?.score;
            const scoreB = bg.teamB?.score;
            if (scoreA === null && scoreB === null) { skipped++; continue; } // nothing to restore
            if (scoreA === undefined && scoreB === undefined) { skipped++; continue; }

            const current = await Game.findById(id).lean();
            if (!current) { skipped++; continue; }

            // Only fix if current scores are null (i.e. affected by the bug), or FORCE=1
            if (FORCE || current.teamA?.score === null || current.teamB?.score === null) {
                await Game.findByIdAndUpdate(id, {
                    "teamA.score": scoreA ?? null,
                    "teamB.score": scoreB ?? null,
                });
                console.log(`  RESTORED ${current.teamA?.name} vs ${current.teamB?.name}  →  ${scoreA} - ${scoreB}`);
                restored++;
            } else {
                skipped++;
            }
        }
        console.log(`\nDone. Restored: ${restored}, Skipped: ${skipped}`);
    } else {
        // Report mode: find completed games with null scores
        const affected = await Game.find({
            status: "completed",
            $or: [{ "teamA.score": null }, { "teamB.score": null }],
        }).lean();

        if (!affected.length) {
            console.log("No completed games with null scores found.");
        } else {
            console.log(`Found ${affected.length} completed game(s) with null scores:\n`);
            for (const g of affected) {
                console.log(`  [${g._id}] ${g.teamA?.name} vs ${g.teamB?.name}  |  ${new Date(g.date).toDateString()}  |  score: ${g.teamA?.score} - ${g.teamB?.score}`);
            }
            console.log(`\nTo restore from backup:`);
            console.log(`  RESTORE=1 BACKUP_FILE=scripts/backup-.../games.json node scripts/fix-null-scores.mjs`);
        }
    }

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    mongoose.disconnect();
    process.exit(1);
});
