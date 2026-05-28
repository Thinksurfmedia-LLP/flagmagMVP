/**
 * Comprehensive score audit & fix for ALL games with play data.
 *
 * Uses activeTeam + safety flag instead of targetTeam (which has data quality issues).
 * Logic:
 *   - Normal scoring play (TD / extra pt): credit ptsAdded to activeTeam
 *   - Safety (safety=true):               credit ptsAdded to the OTHER team
 *
 * Skips games with no Play records (those can't be auto-fixed from plays).
 *
 * Usage:
 *   DRY_RUN=1 node scripts/fix-all-game-scores.mjs       ← preview only, no writes
 *   node scripts/fix-all-game-scores.mjs                  ← apply all fixes
 *   DIFF_ONLY=1 node scripts/fix-all-game-scores.mjs      ← only print mismatches (dry run implied)
 */

import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env manually (no dotenv package needed)
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
} catch { /* no .env file */ }

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/flagmag";
const DRY_RUN    = process.env.DRY_RUN    === "1";
const DIFF_ONLY  = process.env.DIFF_ONLY  === "1"; // implies dry run, only prints discrepancies

// ─── Schemas ────────────────────────────────────────────────────────────────

const GameSchema = new mongoose.Schema({
    league:   mongoose.Schema.Types.ObjectId,
    date:     Date,
    time:     String,
    teamA:    { name: String, logo: String, score: { type: Number, default: null } },
    teamB:    { name: String, logo: String, score: { type: Number, default: null } },
    location: String,
    status:   String,
    gameType: String,
}, { timestamps: true });

const PlaySchema = new mongoose.Schema({
    game:       { type: mongoose.Schema.Types.ObjectId, ref: "Game" },
    activeTeam: String,           // "A" or "B" – the team on offense
    ptsAdded:   { type: Number, default: 0 },
    safety:     { type: Boolean, default: false },
}, { timestamps: true });

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.\n");

    const Game = mongoose.model("Game", GameSchema);
    const Play = mongoose.model("Play", PlaySchema);

    // Load ALL games (completed and in-progress — include all so nothing is missed)
    const games = await Game.find({}).lean();
    console.log(`Total games in DB: ${games.length}\n`);

    const gameIds = games.map(g => g._id);

    // Aggregate: for each (game, scoringTeam) pair, sum ptsAdded.
    // scoringTeam = activeTeam for normal plays, opposite for safeties.
    const agg = await Play.aggregate([
        { $match: { game: { $in: gameIds }, ptsAdded: { $gt: 0 } } },
        {
            $project: {
                game:     1,
                ptsAdded: 1,
                // Determine which team actually scores
                scoringTeam: {
                    $cond: {
                        if:   "$safety",
                        then: { $cond: { if: { $eq: ["$activeTeam", "A"] }, then: "B", else: "A" } },
                        else: "$activeTeam",
                    },
                },
            },
        },
        {
            $group: {
                _id:   { game: "$game", scoringTeam: "$scoringTeam" },
                total: { $sum: "$ptsAdded" },
            },
        },
    ]);

    // Build map: gameId → { A: number, B: number }
    const scoreMap = new Map();
    for (const { _id, total } of agg) {
        const key = String(_id.game);
        if (!scoreMap.has(key)) scoreMap.set(key, { A: 0, B: 0 });
        scoreMap.get(key)[_id.scoringTeam] = total;
    }

    let matched   = 0;
    let fixed     = 0;
    let noPlays   = 0;
    let wouldFix  = 0;

    console.log("─────────────────────────────────────────────────────────────────────");

    for (const game of games) {
        const key    = String(game._id);
        const scores = scoreMap.get(key);
        const label  = `${game.teamA?.name || "?"} vs ${game.teamB?.name || "?"}`;

        if (!scores) {
            noPlays++;
            if (!DIFF_ONLY) {
                console.log(`  NO PLAYS  [${game._id}] ${label}`);
            }
            continue;
        }

        const curA = game.teamA?.score;
        const curB = game.teamB?.score;
        const calcA = scores.A;
        const calcB = scores.B;

        const differs = (curA !== calcA) || (curB !== calcB);

        if (!differs) {
            matched++;
            if (!DIFF_ONLY) {
                console.log(`  OK        [${game._id}] ${label}  ${calcA}-${calcB}`);
            }
            continue;
        }

        // There is a discrepancy
        console.log(
            `  MISMATCH  [${game._id}] ${label}\n` +
            `             DB:   ${curA ?? "null"} - ${curB ?? "null"}\n` +
            `             CALC: ${calcA} - ${calcB}` +
            (DRY_RUN || DIFF_ONLY ? "  [dry run — no change]" : "")
        );

        if (DRY_RUN || DIFF_ONLY) {
            wouldFix++;
        } else {
            await Game.findByIdAndUpdate(game._id, {
                "teamA.score": calcA,
                "teamB.score": calcB,
            });
            fixed++;
        }
    }

    console.log("─────────────────────────────────────────────────────────────────────");
    if (DRY_RUN || DIFF_ONLY) {
        console.log(`\nDry run results:`);
        console.log(`  Already correct : ${matched}`);
        console.log(`  Would fix       : ${wouldFix}`);
        console.log(`  No plays (skip) : ${noPlays}`);
        console.log(`\nRun without DRY_RUN=1 to apply fixes.`);
    } else {
        console.log(`\nResults:`);
        console.log(`  Already correct : ${matched}`);
        console.log(`  Fixed           : ${fixed}`);
        console.log(`  No plays (skip) : ${noPlays}`);
    }

    await mongoose.disconnect();
}

main().catch(err => {
    console.error(err);
    mongoose.disconnect();
    process.exit(1);
});
