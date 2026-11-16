// Splits teams that the legacy import merged by name across locations.
//
// The legacy import matched old-site teams to FlagMag teams by NAME only, so
// e.g. every "The Boys" (Riverside 2021-24, San Marcos, Chino, 4S Poway …) was
// attached to the one current "The Boys" record. The old site kept them as
// separate team records per location. This puts them back apart.
//
// Rule (evidence-based — a league only moves when the data says it's a
// different team):
//   1. A team's leagues are grouped by location (Playoffs/Holiday/day
//      variants of a location are the same location).
//   2. Groups that share players (from imported stat lines and recorded
//      plays) are the same team and are joined.
//   3. Tournament-style leagues (Cash Counties, Christmas, …) join the group
//      they share the most players with.
//   4. Leagues created in FlagMag itself (not imported) never move, and the
//      group holding them — or, for fully imported teams, the group that
//      shares the most players with the current roster / is most recent —
//      keeps the existing team record and its roster.
//   5. Every other group with at least MIN_PLAYERS_TO_SPLIT players moves to
//      a NEW team with the same name/logo. Groups without enough player
//      evidence stay where they are.
//
// Nothing is deleted. Moving a group means: its league memberships move to
// the new team, and its games (teamA/teamB/originalTeamA/B/noStatsOriginal
// teamId) and schedule entries in those leagues point at the new team. Stat
// lines and plays reference games/sides, not teams, so they follow along.
// Each team's split runs in one transaction and is logged to `teamsplits`
// with everything needed to undo it (--undo).
//
// Usage (from the repo root):
//   node scripts/legacy/split-merged-teams.mjs [--org xflagfootball] [--team <id>]   dry run, writes a report
//   node scripts/legacy/split-merged-teams.mjs --apply [--team <id>]                 apply (take a backup first!)
//   node scripts/legacy/split-merged-teams.mjs --undo [--team <id>]                  reverse logged splits

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { loadEnv, REGISTRY } from "./common.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPLIT_LOG = "teamsplits";
const MIN_SHARED_PLAYERS = 2;
const MIN_SHARED_RATIO = 0.25;
const MIN_PLAYERS_TO_SPLIT = 3;
// A group only leaves if it shares at most this many players with the team
// it's leaving — a few people switching teams over the years is normal;
// more than that and it's treated as the same team (nothing moves).
const MAX_SHARED_TO_SPLIT = 2;
const GAME_TEAM_FIELDS = ["teamA", "teamB", "originalTeamA", "originalTeamB", "noStatsOriginalTeam"];
const OFFENSE_FIELDS = ["passerPlayer", "receiverPlayer", "rusherPlayer"];
const DEFENSE_FIELDS = ["defenderPlayer", "flagPullPlayer"];
const PLAY_PLAYER_FIELDS = [...OFFENSE_FIELDS, ...DEFENSE_FIELDS];
const TOURNAMENT_RE = /cash|count(y|ies)|christmas|tournament|kickoff|turkey|bowl|classic|invitational|all[- ]?star/i;

function parseArgs(argv) {
    const args = { org: "xflagfootball", team: null, apply: false, undo: false };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--org") args.org = argv[++i];
        else if (a === "--team") args.team = argv[++i];
        else if (a === "--apply") args.apply = true;
        else if (a === "--undo") args.undo = true;
        else throw new Error(`Unknown argument ${a}`);
    }
    if (args.apply && args.undo) throw new Error("Use either --apply or --undo");
    return args;
}

// "Riverside Playoffs", "Holiday Riverside (Playoffs)", "Riverside (SUN)" → "riverside"
export function locationFamily(name) {
    return String(name || "")
        .toLowerCase()
        .replace(/\([^)]*\)/g, " ")
        .replace(/\b(playoffs?|holiday|preseason|pre-season|post-season|postseason)\b/g, " ")
        .replace(/\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun|am|pm)\b/g, " ")
        .replace(/[^a-z0-9 ]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function shared(a, b) {
    let n = 0;
    for (const x of a) if (b.has(x)) n++;
    return n;
}

function sameTeam(a, b) {
    const n = shared(a, b);
    return n > MAX_SHARED_TO_SPLIT || (n >= MIN_SHARED_PLAYERS && n / Math.max(1, Math.min(a.size, b.size)) >= MIN_SHARED_RATIO);
}

/**
 * Pure planning step (exported for tests).
 * units: [{ leagueId, family, tournament, native, players:Set, startDate }]
 * roster: Set of current roster player ids
 * @returns {{ keep: string[], moves: string[][] }} league ids kept / groups of league ids to move
 */
export function planSplit(units, roster) {
    // 1. Location groups (tournaments float for now).
    const groups = new Map();
    const floating = [];
    for (const u of units) {
        if (u.tournament && !u.native) { floating.push(u); continue; }
        if (!groups.has(u.family)) groups.set(u.family, { units: [], players: new Set(), native: false, latest: 0 });
        const g = groups.get(u.family);
        g.units.push(u);
        u.players.forEach((p) => g.players.add(p));
        g.native ||= u.native;
        g.latest = Math.max(g.latest, u.startDate || 0);
    }
    // 2. Join groups that share players (union-find).
    const list = [...groups.values()];
    const parent = list.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
            if (list[i].native && list[j].native) { parent[find(j)] = find(i); continue; }
            if (sameTeam(list[i].players, list[j].players)) parent[find(j)] = find(i);
        }
    }
    const clusters = new Map();
    list.forEach((g, i) => {
        const r = find(i);
        if (!clusters.has(r)) clusters.set(r, { units: [], players: new Set(), native: false, latest: 0 });
        const c = clusters.get(r);
        c.units.push(...g.units);
        g.players.forEach((p) => c.players.add(p));
        c.native ||= g.native;
        c.latest = Math.max(c.latest, g.latest);
    });
    const all = [...clusters.values()];
    // 4. Which cluster keeps the existing record.
    const score = (c) => [c.native ? 1 : 0, shared(c.players, roster), c.latest];
    const cmp = (a, b) => { const x = score(a), y = score(b); for (let k = 0; k < 3; k++) if (x[k] !== y[k]) return y[k] - x[k]; return 0; };
    all.sort(cmp);
    const primary = all[0] || { units: [], players: new Set() };
    // 3. Tournaments join the cluster they share the most players with.
    for (const u of floating) {
        const best = all
            .map((c) => ({ c, n: shared(u.players, c.players) }))
            .sort((a, b) => b.n - a.n)[0];
        const target = best && best.n >= MIN_SHARED_PLAYERS ? best.c : primary;
        target.units.push(u);
        u.players.forEach((p) => target.players.add(p));
    }
    // 5. Only clusters with real player evidence of being a different team
    // (enough players, almost none shared with the team they'd leave or its
    // current roster, no native league) move.
    // Checked against EVERYTHING that stays (repeated until stable): a group
    // that stays can pull in another group it shares players with.
    let movers = all.slice(1).filter((c) => !c.native && c.players.size >= MIN_PLAYERS_TO_SPLIT);
    const keep = [...primary.units, ...all.slice(1).filter((c) => !movers.includes(c)).flatMap((c) => c.units)];
    for (let changed = true; changed;) {
        changed = false;
        const keptPlayers = new Set([...roster, ...keep.flatMap((u) => [...u.players])]);
        for (const c of movers) {
            if (shared(c.players, keptPlayers) > MAX_SHARED_TO_SPLIT || sameTeam(c.players, keptPlayers)) {
                keep.push(...c.units);
                movers = movers.filter((m) => m !== c);
                changed = true;
                break;
            }
        }
    }
    const moves = movers.map((c) => c.units.map((u) => u.leagueId));
    return { keep: keep.map((u) => u.leagueId), moves };
}

async function loadTeamUnits(db, team, leagueById, importedLeagues) {
    const teamId = team._id;
    const leagueIds = (team.leagues || []).map((m) => m.league).filter(Boolean);
    const games = await db.collection("games")
        .find({ league: { $in: leagueIds }, $or: [{ "teamA.teamId": teamId }, { "teamB.teamId": teamId }] })
        .project({ league: 1, "teamA.teamId": 1, "teamB.teamId": 1 })
        .toArray();
    const sideByGame = new Map(games.map((g) => [String(g._id), String(g.teamA?.teamId) === String(teamId) ? "A" : "B"]));
    const leagueByGame = new Map(games.map((g) => [String(g._id), String(g.league)]));
    const playersByLeague = new Map();
    const add = (leagueId, playerId) => {
        if (!playerId) return;
        if (!playersByLeague.has(leagueId)) playersByLeague.set(leagueId, new Set());
        playersByLeague.get(leagueId).add(String(playerId));
    };
    const gameIds = games.map((g) => g._id);
    const lines = await db.collection("importedstatlines").find({ game: { $in: gameIds } }).project({ game: 1, player: 1, side: 1 }).toArray();
    for (const l of lines) if (sideByGame.get(String(l.game)) === l.side) add(leagueByGame.get(String(l.game)), l.player);
    // A play's activeTeam is the offense: passer/receiver/rusher belong to
    // it, defender/flagPull to the other side (see resolvePlayPlayerIds in
    // src/lib/statsAggregation.js).
    const plays = await db.collection("plays").find({ game: { $in: gameIds } }).project({ game: 1, activeTeam: 1, ...Object.fromEntries(PLAY_PLAYER_FIELDS.map((f) => [f, 1])) }).toArray();
    for (const p of plays) {
        const ourSide = sideByGame.get(String(p.game));
        const fields = p.activeTeam === ourSide ? OFFENSE_FIELDS : DEFENSE_FIELDS;
        for (const f of fields) add(leagueByGame.get(String(p.game)), p[f]);
    }
    return (team.leagues || []).filter((m) => m.league).map((m) => {
        const l = leagueById.get(String(m.league)) || {};
        const locName = (l.locations || [])[0] || l.location || l.name;
        return {
            leagueId: String(m.league),
            label: `${l.seasonName || "?"} | ${l.name || "(deleted league)"}`,
            family: locationFamily(locName),
            tournament: TOURNAMENT_RE.test(`${l.name} ${locName}`),
            native: !importedLeagues.has(String(m.league)),
            players: playersByLeague.get(String(m.league)) || new Set(),
            startDate: l.startDate ? new Date(l.startDate).getTime() : 0,
        };
    });
}

async function planOrg(db, orgId, onlyTeamId) {
    const leagues = await db.collection("leagues").find({ organization: orgId }).project({ name: 1, season: 1, locations: 1, location: 1, startDate: 1 }).toArray();
    const seasons = new Map((await db.collection("seasons").find({ organization: orgId }).project({ name: 1 }).toArray()).map((s) => [String(s._id), s.name]));
    const leagueById = new Map(leagues.map((l) => [String(l._id), { ...l, seasonName: seasons.get(String(l.season)) }]));
    const importedLeagues = new Set((await db.collection(REGISTRY).find({ entity: "league" }).project({ docId: 1 }).toArray()).map((r) => String(r.docId)));
    const filter = { organization: orgId, isPlaceholder: { $ne: true }, "leagues.1": { $exists: true } };
    if (onlyTeamId) filter._id = new mongoose.Types.ObjectId(onlyTeamId);
    const teams = await db.collection("teams").find(filter).toArray();

    const plans = [];
    for (const team of teams) {
        // Only teams that actually got imported memberships can be merged.
        if (!(team.leagues || []).some((m) => importedLeagues.has(String(m.league)))) continue;
        const units = await loadTeamUnits(db, team, leagueById, importedLeagues);
        if (new Set(units.map((u) => u.family)).size < 2) continue;
        const roster = new Set((team.players || []).map((p) => String(p.player)));
        const { keep, moves } = planSplit(units, roster);
        if (moves.length === 0) continue;
        const label = new Map(units.map((u) => [u.leagueId, u.label]));
        const playerSet = (ids) => new Set(ids.flatMap((id) => [...(units.find((u) => u.leagueId === id)?.players || [])]));
        const playersOf = (ids) => playerSet(ids).size;
        const keptPlayers = playerSet(keep);
        plans.push({
            teamId: String(team._id),
            name: team.name,
            rosterSize: roster.size,
            keep: keep.map((id) => label.get(id)),
            keepPlayers: playersOf(keep),
            newTeams: moves.map((ids) => ({ leagueIds: ids, leagues: ids.map((id) => label.get(id)), players: playersOf(ids), sharedWithKept: shared(playerSet(ids), keptPlayers) })),
        });
    }
    return plans;
}

async function applyOne(db, plan) {
    const session = mongoose.connection.client.startSession();
    try {
        await session.withTransaction(async () => {
            const original = await db.collection("teams").findOne({ _id: new mongoose.Types.ObjectId(plan.teamId) }, { session });
            if (!original) throw new Error(`Team ${plan.teamId} not found`);
            const now = new Date();
            for (const group of plan.newTeams) {
                const leagueIds = group.leagueIds.map((id) => new mongoose.Types.ObjectId(id));
                const idSet = new Set(group.leagueIds);
                const memberships = (original.leagues || []).filter((m) => idSet.has(String(m.league)));
                if (memberships.length !== leagueIds.length) throw new Error(`${plan.name}: memberships changed since planning — re-run the dry run`);
                const { _id, players, retiredNumbers, leagues, __v, ...copy } = original;
                const newTeamId = new mongoose.Types.ObjectId();
                await db.collection("teams").insertOne({ ...copy, _id: newTeamId, players: [], retiredNumbers: [], leagues: memberships, createdAt: now, updatedAt: now, __v: 0 }, { session });
                await db.collection("teams").updateOne(
                    { _id: original._id },
                    { $pull: { leagues: { _id: { $in: memberships.map((m) => m._id) } } }, $set: { updatedAt: now }, $inc: { __v: 1 } },
                    { session }
                );
                const gamesChanged = {};
                for (const f of GAME_TEAM_FIELDS) {
                    const q = { league: { $in: leagueIds }, [`${f}.teamId`]: original._id };
                    const ids = (await db.collection("games").find(q, { session }).project({ _id: 1 }).toArray()).map((g) => g._id);
                    if (ids.length === 0) continue;
                    await db.collection("games").updateMany({ _id: { $in: ids } }, { $set: { [`${f}.teamId`]: newTeamId, updatedAt: now } }, { session });
                    gamesChanged[f] = ids;
                }
                const schedules = await db.collection("schedules").find({ leagueId: { $in: leagueIds }, $or: [{ "weeks.games.team1": original._id }, { "weeks.games.team2": original._id }] }, { session }).project({ _id: 1 }).toArray();
                for (const side of ["team1", "team2"]) {
                    await db.collection("schedules").updateMany(
                        { _id: { $in: schedules.map((s) => s._id) } },
                        { $set: { [`weeks.$[].games.$[g].${side}`]: newTeamId, updatedAt: now } },
                        { arrayFilters: [{ [`g.${side}`]: original._id }], session }
                    );
                }
                // Keep the importer's registry consistent: its membership rows
                // now point at the team that actually holds the membership.
                const regKeys = group.leagueIds.map((lid) => `${original._id}:${lid}`);
                const regRows = await db.collection(REGISTRY).find({ entity: "membership", legacyId: { $in: regKeys } }, { session }).project({ _id: 1 }).toArray();
                await db.collection(REGISTRY).updateMany({ _id: { $in: regRows.map((r) => r._id) } }, { $set: { docId: newTeamId } }, { session });
                await db.collection(SPLIT_LOG).insertOne({
                    at: now, originalTeam: original._id, newTeam: newTeamId, name: original.name,
                    leagues: leagueIds, memberships, gamesChanged, schedules: schedules.map((s) => s._id), registryRows: regRows.map((r) => r._id),
                    undone: false,
                }, { session });
            }
        });
    } finally {
        await session.endSession();
    }
}

async function undoOne(db, log) {
    const session = mongoose.connection.client.startSession();
    try {
        await session.withTransaction(async () => {
            const now = new Date();
            const moved = await db.collection("teams").findOne({ _id: log.newTeam }, { session });
            if (!moved) throw new Error(`Split team ${log.newTeam} is gone`);
            if ((moved.players || []).length > 0) throw new Error(`${log.name} (${log.newTeam}) has players added since the split — move them back by hand first`);
            const extra = (moved.leagues || []).filter((m) => !log.leagues.some((l) => String(l) === String(m.league)));
            if (extra.length > 0) throw new Error(`${log.name} (${log.newTeam}) was added to other leagues since the split — undo by hand`);
            await db.collection("teams").updateOne({ _id: log.originalTeam }, { $push: { leagues: { $each: moved.leagues } }, $set: { updatedAt: now }, $inc: { __v: 1 } }, { session });
            for (const [f, ids] of Object.entries(log.gamesChanged || {})) {
                await db.collection("games").updateMany({ _id: { $in: ids }, [`${f}.teamId`]: log.newTeam }, { $set: { [`${f}.teamId`]: log.originalTeam, updatedAt: now } }, { session });
            }
            for (const side of ["team1", "team2"]) {
                await db.collection("schedules").updateMany(
                    { _id: { $in: log.schedules } },
                    { $set: { [`weeks.$[].games.$[g].${side}`]: log.originalTeam, updatedAt: now } },
                    { arrayFilters: [{ [`g.${side}`]: log.newTeam }], session }
                );
            }
            await db.collection(REGISTRY).updateMany({ _id: { $in: log.registryRows } }, { $set: { docId: log.originalTeam } }, { session });
            await db.collection("teams").deleteOne({ _id: log.newTeam }, { session }); // empty shell: its leagues were just moved back
            await db.collection(SPLIT_LOG).updateOne({ _id: log._id }, { $set: { undone: true, undoneAt: now } }, { session });
        });
    } finally {
        await session.endSession();
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    loadEnv();
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000, socketTimeoutMS: 120000 });
    const db = mongoose.connection.db;
    try {
        const org = await db.collection("organizations").findOne({ slug: args.org });
        if (!org) throw new Error(`Organization ${args.org} not found`);

        if (args.undo) {
            const q = { undone: false };
            if (args.team) q.originalTeam = new mongoose.Types.ObjectId(args.team);
            const logs = await db.collection(SPLIT_LOG).find(q).sort({ at: -1 }).toArray();
            for (const log of logs) { await undoOne(db, log); console.log(`undone: ${log.name} ${log.newTeam} -> ${log.originalTeam}`); }
            console.log(`Undid ${logs.length} split(s).`);
            return;
        }

        const plans = await planOrg(db, org._id, args.team);
        const reportDir = path.join(__dirname, "reports");
        fs.mkdirSync(reportDir, { recursive: true });
        const reportFile = path.join(reportDir, `split-merged-teams-${args.org}${args.team ? `-${args.team}` : ""}.json`);
        fs.writeFileSync(reportFile, JSON.stringify(plans, null, 2));
        const newTeams = plans.reduce((n, p) => n + p.newTeams.length, 0);
        const movedLeagues = plans.reduce((n, p) => n + p.newTeams.reduce((m, t) => m + t.leagueIds.length, 0), 0);
        console.log(`${plans.length} team(s) to split into ${newTeams} new team(s), moving ${movedLeagues} league membership(s). Report: ${path.relative(process.cwd(), reportFile)}`);
        if (!args.apply) { console.log("Dry run — nothing written. Re-run with --apply (after a backup) to split."); return; }

        // Each team is its own transaction: one failure is reported and
        // skipped (that team is left exactly as it was), the rest carry on.
        let done = 0;
        const failed = [];
        for (const plan of plans) {
            try {
                await applyOne(db, plan);
                done++;
            } catch (error) {
                failed.push({ teamId: plan.teamId, name: plan.name, error: error.message });
                console.error(`skipped ${plan.name} (${plan.teamId}): ${error.message}`);
            }
            if ((done + failed.length) % 25 === 0) console.log(`progress ${done + failed.length}/${plans.length}`);
        }
        console.log(`Applied ${done}/${plans.length}; skipped ${failed.length}.`);
        if (failed.length) fs.writeFileSync(reportFile.replace(/\.json$/, "-failed.json"), JSON.stringify(failed, null, 2));
    } finally {
        await mongoose.disconnect();
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch((error) => { console.error(error); process.exit(1); });
}
