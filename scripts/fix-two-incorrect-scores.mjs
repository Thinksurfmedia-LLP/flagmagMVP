/**
 * Fix all known-wrong game scores.
 * Correct values verified against zortssports.com game results and backup analysis.
 *
 * Mayhem 10u vs Scallywags 10u:       NULL - 32  →   0 - 32   (null filled in)
 * Hot Shotz 8u vs Blue Heat 8u:         12 - 13  →  12 - 19   (backup had wrong value)
 * Renegades 10u vs Pick 6 Mafia 10u:    25 -  0  →  32 -  0   (backup had wrong value)
 *
 * Usage:
 *   DRY_RUN=1 node scripts/fix-two-incorrect-scores.mjs
 *   node scripts/fix-two-incorrect-scores.mjs
 */

import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";

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
const DRY_RUN    = process.env.DRY_RUN === "1";

const fixes = [
    {
        _id:   "69d0bd9e80313eff138f783c",
        label: "Mayhem 10u vs Scallywags 10u",
        teamA: { score: 0 },   // was NULL — confirmed 0-32 via zortssports
        teamB: { score: 32 },
    },
    {
        _id:   "69d0bd9d80313eff138f7830",
        label: "Hot Shotz 8u vs Blue Heat 8u",
        teamA: { score: 12 },
        teamB: { score: 19 },  // backup had 13, correct is 19 per zortssports
    },
    {
        _id:   "69d0bd9f80313eff138f7842",
        label: "Renegades 10u vs Pick 6 Mafia 10u",
        teamA: { score: 32 },  // backup had 25, correct is 32 per zortssports
        teamB: { score: 0 },
    },
];

const GameSchema = new mongoose.Schema({
    teamA: { name: String, logo: String, score: Number },
    teamB: { name: String, logo: String, score: Number },
}, { strict: false, timestamps: true });

async function main() {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.\n");

    const Game = mongoose.model("Game", GameSchema);

    for (const fix of fixes) {
        const game = await Game.findById(fix._id).lean();
        if (!game) {
            console.log(`  NOT FOUND: ${fix.label} (${fix._id})`);
            continue;
        }
        console.log(
            `  ${fix.label}`
            + `\n    teamA: ${game.teamA?.score} → ${fix.teamA.score}`
            + `\n    teamB: ${game.teamB?.score} → ${fix.teamB.score}`
            + (DRY_RUN ? "  [dry run]" : "")
        );
        if (!DRY_RUN) {
            await Game.findByIdAndUpdate(fix._id, {
                "teamA.score": fix.teamA.score,
                "teamB.score": fix.teamB.score,
            });
        }
    }

    console.log(DRY_RUN ? "\nDry run complete — no changes written." : "\nDone.");
    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
