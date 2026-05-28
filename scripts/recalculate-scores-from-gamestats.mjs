/**
 * Recalculate game scores from GameStat records (admin-entered per-player stats).
 *
 * Scoring formula (to avoid double-counting passing + receiving TDs):
 *   score = (receiving.tds + rushing.tds) * 6
 *         + (receiving.xp2 + rushing.xp2) * 2
 *
 * Only updates games that have GameStat data. Games with no records are skipped.
 *
 * Usage:
 *   DRY_RUN=1 node scripts/recalculate-scores-from-gamestats.mjs   (preview)
 *   node scripts/recalculate-scores-from-gamestats.mjs              (write)
 *   ALL=1 node scripts/recalculate-scores-from-gamestats.mjs        (include non-completed)
 */

import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load .env manually ───────────────────────────────────────────────────────
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
const DRY_RUN   = process.env.DRY_RUN === "1";
const ALL       = process.env.ALL === "1";

// ── Minimal schemas ───────────────────────────────────────────────────────────
const GameSchema = new mongoose.Schema({
    league:  mongoose.Schema.Types.ObjectId,
    date:    Date,
    time:    String,
    teamA:   { name: String, logo: String, score: { type: Number, default: null } },
    teamB:   { name: String, logo: String, score: { type: Number, default: null } },
    location: String,
    status:  String,
    gameType: String,
}, { timestamps: true });

const GameStatSchema = new mongoose.Schema({
    game:     { type: mongoose.Schema.Types.ObjectId, ref: "Game" },
    player:   { type: mongoose.Schema.Types.ObjectId, ref: "Player" },
    teamName: String,
    statType: String,   // "passing" | "rushing" | "receiving"
    tds:      { type: Number, default: 0 },
    xp2:      { type: Number, default: 0 },
}, { strict: false, timestamps: true });

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.\n");

    const Game     = mongoose.model("Game",     GameSchema);
    const GameStat = mongoose.model("GameStat", GameStatSchema);

    // Fetch target games
    const filter = ALL ? {} : { status: "completed" };
    if (!ALL) filter.gameType = { $ne: "practice" };
    const games = await Game.find(filter).lean();
    console.log(`Checking ${games.length} game(s)...\n`);

    let updated  = 0;
    let noStats  = 0;
    let skipped  = 0;

    for (const game of games) {
        const gameId = game._id;

        // Pull receiving + rushing records only (avoids double-counting passing TDs)
        const stats = await GameStat.find({
            game: gameId,
            statType: { $in: ["receiving", "rushing"] },
        }).lean();

        if (!stats.length) {
            noStats++;
            continue;
        }

        // Sum tds and xp2 per teamName (case-insensitive key)
        const scoreByTeam = {};
        for (const s of stats) {
            const key = (s.teamName || "").trim().toLowerCase();
            if (!scoreByTeam[key]) scoreByTeam[key] = 0;
            scoreByTeam[key] += (s.tds || 0) * 6 + (s.xp2 || 0) * 2;
        }

        const aKey   = (game.teamA?.name || "").trim().toLowerCase();
        const bKey   = (game.teamB?.name || "").trim().toLowerCase();
        const aScore = scoreByTeam[aKey] ?? null;
        const bScore = scoreByTeam[bKey] ?? null;

        if (aScore === null && bScore === null) {
            noStats++;
            continue;
        }

        const unchanged =
            game.teamA?.score === aScore && game.teamB?.score === bScore;
        if (unchanged) { skipped++; continue; }

        console.log(
            `  ${game.teamA?.name} vs ${game.teamB?.name}`
            + `   ${game.teamA?.score ?? "null"} → ${aScore}`
            + `   /   ${game.teamB?.score ?? "null"} → ${bScore}`
            + (DRY_RUN ? "  [dry run]" : "")
        );

        if (!DRY_RUN) {
            await Game.findByIdAndUpdate(gameId, {
                "teamA.score": aScore,
                "teamB.score": bScore,
            });
        }
        updated++;
    }

    console.log(`\n── Summary ──`);
    console.log(`  Updated : ${updated}`);
    console.log(`  Unchanged : ${skipped}`);
    console.log(`  No GameStat data : ${noStats}`);

    if (noStats > 0) {
        console.log(
            `\n  ⚠  ${noStats} game(s) had no receiving/rushing GameStat records.`
            + `\n     These were not changed. Scores from those games still reflect`
            + `\n     whatever was last written (backup restore or recalculate script).`
        );
    }

    await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
