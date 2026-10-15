// Undo one legacy season import (scripts/legacy/import-season.mjs), using the
// `legacyimports` registry it wrote. Only documents that import CREATED are
// removed; linked pre-existing teams/players are left alone apart from the
// league memberships the import added to them.
//
//   node --import ./scripts/lib/alias-loader.mjs scripts/legacy/rollback-season.mjs --season <legacySeasonId> [--apply]
//
// Without --apply it only prints what would be removed.

import mongoose from "mongoose";
import Season from "@/models/Season";
import League from "@/models/League";
import Team from "@/models/Team";
import Player from "@/models/Player";
import Game from "@/models/Game";
import Schedule from "@/models/Schedule";
import Play from "@/models/Play";
import ImportedStatLine from "@/models/ImportedStatLine";
import { loadEnv, REGISTRY, SYSTEM } from "./common.mjs";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const season = Number(args[args.indexOf("--season") + 1]);
if (!Number.isInteger(season)) {
    console.error("Usage: rollback-season.mjs --season <legacySeasonId> [--apply]");
    process.exit(1);
}

async function main() {
    loadEnv();
    await mongoose.connect(process.env.MONGODB_URI);
    const reg = mongoose.connection.db.collection(REGISTRY);
    const entries = await reg.find({ system: SYSTEM, legacySeasonId: season }).toArray();
    const ids = (entity) => entries.filter((e) => e.entity === entity && e.created).map((e) => e.docId);

    const gameIds = ids("game");
    const leagueIds = ids("league");
    const teamIds = ids("team");
    const playerIds = ids("player");

    // Safety: refuse if anything recorded since the import now depends on
    // these documents (live plays on an imported game, a created team or
    // player picked up by another league/roster, etc.).
    const blockers = [];
    if (await Play.exists({ game: { $in: gameIds } })) blockers.push("imported games have live plays");
    const otherLeagueTeams = await Team.countDocuments({ _id: { $in: teamIds }, leagues: { $elemMatch: { league: { $nin: leagueIds } } } });
    if (otherLeagueTeams) blockers.push(`${otherLeagueTeams} created teams joined other leagues`);
    const rosteredPlayers = await Team.countDocuments({ "players.player": { $in: playerIds } });
    if (rosteredPlayers) blockers.push(`${rosteredPlayers} teams have created players on their roster`);
    const otherLines = await ImportedStatLine.countDocuments({ player: { $in: playerIds }, game: { $nin: gameIds } });
    if (otherLines) blockers.push(`${otherLines} stat lines from other seasons use created players`);
    const otherLeagues = await League.countDocuments({ season: { $in: ids("season") }, _id: { $nin: leagueIds } });
    if (otherLeagues) blockers.push(`${otherLeagues} leagues not created by this import belong to the imported season`);

    const plan = {
        statLines: await ImportedStatLine.countDocuments({ game: { $in: gameIds } }),
        games: gameIds.length,
        schedules: ids("schedule").length,
        memberships: entries.filter((e) => e.entity === "membership").length,
        leagues: leagueIds.length,
        teams: teamIds.length,
        players: playerIds.length,
        season: ids("season").length,
        blockers,
    };
    console.log(JSON.stringify(plan, null, 2));

    if (!apply) {
        console.log("Dry run — nothing removed. Re-run with --apply.");
    } else if (blockers.length) {
        console.error("Refusing to roll back while blockers exist.");
        process.exitCode = 2;
    } else {
        await ImportedStatLine.deleteMany({ game: { $in: gameIds } });
        await Game.deleteMany({ _id: { $in: gameIds } });
        await Schedule.deleteMany({ _id: { $in: ids("schedule") } });
        await Team.updateMany({ "leagues.league": { $in: leagueIds } }, { $pull: { leagues: { league: { $in: leagueIds } } } });
        await League.deleteMany({ _id: { $in: leagueIds } });
        await Team.deleteMany({ _id: { $in: teamIds } });
        await Player.deleteMany({ _id: { $in: playerIds } });
        await Season.deleteMany({ _id: { $in: ids("season") } });
        await reg.deleteMany({ system: SYSTEM, legacySeasonId: season });
        console.log("Rolled back.");
    }
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
