/**
 * Recalculate game scores from play-by-play data.
 *
 * For every completed Game that has null scores, this script sums up
 * `ptsAdded` from the Play collection (grouped by targetTeam A / B)
 * and writes the result back to teamA.score / teamB.score on the Game.
 *
 * Usage:
 *   node scripts/recalculate-scores-from-plays.mjs          (all null-score completed games)
 *   ALL=1 node scripts/recalculate-scores-from-plays.mjs    (all completed games, even with existing scores)
 *   DRY_RUN=1 node scripts/recalculate-scores-from-plays.mjs
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
const DRY_RUN = process.env.DRY_RUN === "1";
const ALL = process.env.ALL === "1"; // re-calculate even games that already have scores

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

const PlaySchema = new mongoose.Schema({
    game: mongoose.Schema.Types.ObjectId,
    type: String,
    activeTeam: String,
    teamName: String,
    half: String,
    ptsAdded: { type: Number, default: 0 },
    targetTeam: { type: String, default: "" },
}, { timestamps: true });

async function main() {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.\n");

    const Game = mongoose.model("Game", GameSchema);
    const Play = mongoose.model("Play", PlaySchema);

    // Find games to fix
    const filter = { status: "completed" };
    if (!ALL) {
        filter.$or = [{ "teamA.score": null }, { "teamB.score": null }];
    }

    const games = await Game.find(filter).lean();
    console.log(`Found ${games.length} game(s) to process.\n`);

    if (!games.length) {
        console.log("Nothing to fix.");
        await mongoose.disconnect();
        return;
    }

    // Aggregate points per game per targetTeam in one query
    const gameIds = games.map((g) => g._id);
    const agg = await Play.aggregate([
        { $match: { game: { $in: gameIds }, ptsAdded: { $gt: 0 } } },
        {
            $group: {
                _id: { game: "$game", targetTeam: "$targetTeam" },
                total: { $sum: "$ptsAdded" },
            },
        },
    ]);

    // Build a map: gameId → { A: score, B: score }
    const scoreMap = new Map();
    for (const { _id, total } of agg) {
        const key = String(_id.game);
        if (!scoreMap.has(key)) scoreMap.set(key, { A: 0, B: 0 });
        const entry = scoreMap.get(key);
        if (_id.targetTeam === "A") entry.A = total;
        else if (_id.targetTeam === "B") entry.B = total;
    }

    let updated = 0;
    let noPlays = 0;

    for (const game of games) {
        const key = String(game._id);
        const scores = scoreMap.get(key);

        if (!scores) {
            console.log(`  NO PLAYS  [${game._id}] ${game.teamA?.name} vs ${game.teamB?.name}`);
            noPlays++;
            continue;
        }

        console.log(
            `  ${DRY_RUN ? "WOULD UPDATE" : "UPDATING"}  [${game._id}] ` +
            `${game.teamA?.name} vs ${game.teamB?.name}  →  ${scores.A} - ${scores.B}`
        );

        if (!DRY_RUN) {
            await Game.findByIdAndUpdate(game._id, {
                "teamA.score": scores.A,
                "teamB.score": scores.B,
            });
        }
        updated++;
    }

    console.log(`\nDone. ${DRY_RUN ? "Would update" : "Updated"}: ${updated}, No plays found: ${noPlays}`);
    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    mongoose.disconnect();
    process.exit(1);
});
