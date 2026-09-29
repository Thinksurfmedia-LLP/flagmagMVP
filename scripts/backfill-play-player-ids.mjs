// One-time backfill: freeze player identity onto legacy plays.
//
// Plays recorded before the frozen `<field>Player` ids existed (or where the
// write-time lookup was skipped) are still attributed at READ time by
// looking their jersey number up against each team's CURRENT roster (see
// resolvePlayerField in src/lib/statsAggregation.js). So renumbering a
// player, or giving an old number to someone new, silently moves those
// historical stats. This script writes today's attribution onto the play so
// history stops depending on the live roster.
//
// Safety:
//   - Uses the app's own resolvePlayPlayerIds / getFieldSides / buildRosterMap
//     rules, so each id written is exactly who stats pages credit TODAY.
//   - Only fills a field that is null/missing (or linked to a since-DELETED
//     player, which stats would otherwise show as "Former player") AND has
//     a jersey number.
//   - Skips any jersey number held by 2+ roster entries on that team
//     (ambiguous — the game view and season view could disagree).
//   - --apply backs up every touched play's original fields first, then
//     re-computes season + game stats for every affected league/game and
//     reports any difference (there should be none).
//
// Usage:
//   node --import ./scripts/lib/alias-loader.mjs scripts/backfill-play-player-ids.mjs          # dry run
//   node --import ./scripts/lib/alias-loader.mjs scripts/backfill-play-player-ids.mjs --apply  # write

import mongoose from "mongoose";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import Play from "@/models/Play";
import Game from "@/models/Game";
import League from "@/models/League";
import Team from "@/models/Team";
import Player from "@/models/Player";
import {
    resolvePlayPlayerIds,
    getFieldSides,
    computeSeasonStats,
    computeGameStats,
} from "@/lib/statsAggregation";

try {
    const lines = readFileSync(resolve(process.cwd(), ".env"), "utf8").split("\n");
    for (const line of lines) {
        const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/);
        if (m) { const k = m[1], v = m[2].replace(/^["']|["']$/g, ""); if (!process.env[k]) process.env[k] = v; }
    }
} catch { /**/ }

if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set");
    process.exit(1);
}

const APPLY = process.argv.includes("--apply");
const FIELDS = ["passer", "receiver", "rusher", "defender", "flagPull"];
const SEASON_CACHE_WAIT_MS = 11_000; // > SEASON_STATS_TTL_MS in statsAggregation.js

// Same shape + precedence as buildRosterMap (active entry wins a jersey slot),
// plus the set of jersey numbers that are ambiguous on this team.
function rosterForTeam(team) {
    const map = {};
    const counts = {};
    for (const p of team?.players || []) {
        const key = String(p.jerseyNumber);
        counts[key] = (counts[key] || 0) + 1;
        if (!map[key] || p.active !== false) map[key] = { playerId: String(p.player) };
    }
    const ambiguous = new Set(Object.keys(counts).filter((k) => counts[k] > 1));
    return { map, ambiguous };
}

async function loadGameContext(gameId) {
    const game = await Game.findById(gameId).select("league teamA.name teamB.name").lean();
    if (!game?.league) return { skip: "game has no league" };
    const league = await League.findById(game.league).select("organization").lean();
    if (!league?.organization) return { skip: "league has no organization" };
    if (game.teamA?.name === game.teamB?.name) return { skip: "both sides share a team name" };

    const teams = await Team.find({
        organization: league.organization,
        name: { $in: [game.teamA?.name, game.teamB?.name] },
        "leagues.league": game.league,
    }).select("name players").lean();
    const teamA = teams.filter((t) => t.name === game.teamA?.name);
    const teamB = teams.filter((t) => t.name === game.teamB?.name);
    if (teamA.length > 1 || teamB.length > 1) return { skip: "several same-named teams in league" };

    return {
        leagueId: String(game.league),
        orgId: String(league.organization),
        sides: { A: rosterForTeam(teamA[0]), B: rosterForTeam(teamB[0]) },
    };
}

function planForPlay(play, ctx, tally, livePlayerIds) {
    const rosterMap = { A: ctx.sides.A.map, B: ctx.sides.B.map };
    const resolved = resolvePlayPlayerIds(play, rosterMap);
    const sides = getFieldSides(play.type, play.activeTeam);
    const set = {};
    for (const [fieldKey, side] of Object.entries(sides)) {
        const raw = play[fieldKey.replace(/Player$/, "")];
        if (!raw) continue;
        if (play[fieldKey] && livePlayerIds.has(String(play[fieldKey]))) continue;
        if (ctx.sides[side]?.ambiguous.has(String(raw))) { tally.ambiguous++; continue; }
        if (!resolved[fieldKey]) { tally.unresolved++; continue; }
        set[fieldKey] = new mongoose.Types.ObjectId(resolved[fieldKey]);
    }
    return set;
}

async function snapshot(leagueTargets, gameIds) {
    const seasons = {};
    for (const [leagueId, orgId] of leagueTargets) {
        seasons[leagueId] = JSON.stringify(await computeSeasonStats(leagueId, orgId));
    }
    const games = {};
    for (const gid of gameIds) games[gid] = JSON.stringify((await computeGameStats(gid))?.stats);
    return { seasons, games };
}

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
try {
    const livePlayerIds = new Set((await Player.find({}).select("_id").lean()).map((p) => String(p._id)));
    const withLinks = await Play.find({ $or: FIELDS.map((f) => ({ [`${f}Player`]: { $ne: null } })) })
        .select(FIELDS.map((f) => `${f}Player`).join(" ")).lean();
    const deadLinked = withLinks
        .filter((p) => FIELDS.some((f) => p[`${f}Player`] && !livePlayerIds.has(String(p[`${f}Player`]))))
        .map((p) => p._id);
    const candidates = await Play.find({
        $or: [
            ...FIELDS.map((f) => ({ [f]: { $nin: ["", null] }, [`${f}Player`]: null })),
            { _id: { $in: deadLinked } },
        ],
    }).lean();

    const byGame = new Map();
    for (const p of candidates) byGame.set(String(p.game), [...(byGame.get(String(p.game)) || []), p]);

    const tally = { ambiguous: 0, unresolved: 0, fieldsToSet: 0, gamesSkipped: {} };
    const ops = [];
    const backup = [];
    const leagueTargets = new Map();
    const touchedGames = new Set();

    for (const [gameId, plays] of byGame) {
        const ctx = await loadGameContext(gameId);
        if (ctx.skip) { tally.gamesSkipped[ctx.skip] = (tally.gamesSkipped[ctx.skip] || 0) + plays.length; continue; }
        for (const play of plays) {
            const set = planForPlay(play, ctx, tally, livePlayerIds);
            const keys = Object.keys(set);
            if (keys.length === 0) continue;
            tally.fieldsToSet += keys.length;
            ops.push({ updateOne: { filter: { _id: play._id }, update: { $set: set } } });
            backup.push({ _id: play._id, ...Object.fromEntries(keys.map((k) => [k, play[k] ?? null])) });
            leagueTargets.set(ctx.leagueId, ctx.orgId);
            touchedGames.add(gameId);
        }
    }

    console.log(`Legacy plays with an unfrozen jersey field: ${candidates.length} (in ${byGame.size} games)`);
    console.log(`Plays to update: ${ops.length} | fields to freeze: ${tally.fieldsToSet}`);
    console.log(`Left alone — ambiguous jersey (2+ roster entries): ${tally.ambiguous}`);
    console.log(`Left alone — jersey matches nobody on current roster: ${tally.unresolved}`);
    console.log(`Plays in skipped games: ${JSON.stringify(tally.gamesSkipped)}`);
    console.log(`Affected: ${leagueTargets.size} leagues, ${touchedGames.size} games`);

    if (!APPLY) {
        console.log("\nDry run — nothing written. Re-run with --apply to write.");
    } else if (ops.length > 0) {
        console.log("\nSnapshotting stats before write...");
        const before = await snapshot(leagueTargets, touchedGames);

        mkdirSync("db-backups/manual", { recursive: true });
        const file = `db-backups/manual/${new Date().toISOString().replace(/[:.]/g, "-")}-play-player-ids-backfill.json`;
        writeFileSync(file, JSON.stringify(backup));
        console.log(`Backup of original fields: ${file}`);

        const res = await Play.bulkWrite(ops, { ordered: false });
        console.log(`Written: ${res.modifiedCount} plays`);

        await new Promise((r) => setTimeout(r, SEASON_CACHE_WAIT_MS));
        const after = await snapshot(leagueTargets, touchedGames);
        const seasonDiffs = Object.keys(before.seasons).filter((k) => before.seasons[k] !== after.seasons[k]);
        const gameDiffs = Object.keys(before.games).filter((k) => before.games[k] !== after.games[k]);
        console.log(`Verify — season stats changed in ${seasonDiffs.length}/${leagueTargets.size} leagues, game stats changed in ${gameDiffs.length}/${touchedGames.size} games`);
        if (seasonDiffs.length || gameDiffs.length) {
            console.log("DIFF leagues:", seasonDiffs.join(", ") || "-", "| DIFF games:", gameDiffs.join(", ") || "-");
            process.exitCode = 2;
        }
    }
} finally {
    await mongoose.disconnect();
}
