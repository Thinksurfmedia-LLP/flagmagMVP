import mongoose from "mongoose";
import Player from "@/models/Player";
import Team from "@/models/Team";
import Play from "@/models/Play";
import Award from "@/models/Award";
import GameStat from "@/models/GameStat";
import Game from "@/models/Game";
import League from "@/models/League";
import "@/models/Season"; // registers the model populate("season") needs
import ImportedStatLine from "@/models/ImportedStatLine";
import PlayerMerge from "@/models/PlayerMerge";
import { inTransaction } from "@/lib/teamJerseyGuard";
import { FROZEN_PLAYER_FIELDS } from "@/lib/playerDeletion";
import { findSharedGames, mergeBlockers, seasonSortKey } from "@/lib/playerMergePlan";

// Merge duplicate player records into one player.
//
// Why: the old XFlag site often recorded only a jersey number, so the import
// kept each of those players' stats on a stand-in record named
// "<Team> #<jersey> (<Season>)". When an organizer knows who that was (e.g.
// every "#56" on Mike Zimmerman's teams), merging moves those stats onto the
// real player, so his profile and leaderboards show his whole history.
//
// Nothing is lost: every re-pointed row id and the full original player
// documents are saved in `playermerges`, and undoMerge() puts them back.

const HISTORY_ROW_LIMIT = 60;
const LEGACY_REGISTRY = "legacyimports";

const oid = (id) => new mongoose.Types.ObjectId(String(id));

/**
 * Which teams/seasons each player has stats in — how an organizer tells
 * stand-in records apart before merging them.
 * @param {string[]} playerIds
 * @returns {Promise<Map<string, { games: number, rows: Array<{ league: string, season: string, team: string, games: number }> }>>}
 */
export async function playerHistories(playerIds) {
    const ids = playerIds.map(oid);
    const [lineGroups, playGames] = await Promise.all([
        ImportedStatLine.aggregate([
            { $match: { player: { $in: ids } } },
            { $group: { _id: { player: "$player", league: "$league", side: "$side" }, games: { $addToSet: "$game" } } },
        ]),
        Promise.all(FROZEN_PLAYER_FIELDS.map((field) =>
            Play.aggregate([
                { $match: { [field]: { $in: ids } } },
                { $group: { _id: `$${field}`, games: { $addToSet: "$game" } } },
            ])
        )),
    ]);

    const sampleGameIds = lineGroups.map((g) => g.games[0]);
    const leagueIds = [...new Set(lineGroups.map((g) => String(g._id.league)))];
    const [games, leagues] = await Promise.all([
        Game.find({ _id: { $in: sampleGameIds } }).select("teamA.name teamB.name").lean(),
        League.find({ _id: { $in: leagueIds } }).select("name season").populate("season", "name").lean(),
    ]);
    const gameById = new Map(games.map((g) => [String(g._id), g]));
    const leagueById = new Map(leagues.map((l) => [String(l._id), l]));

    // One row per league + team: a team is side A in some games and side B
    // in others, which the aggregate above keeps apart.
    const out = new Map(playerIds.map((id) => [String(id), { gameIds: new Set(), rows: new Map() }]));
    for (const group of lineGroups) {
        const entry = out.get(String(group._id.player));
        if (!entry) continue;
        group.games.forEach((g) => entry.gameIds.add(String(g)));
        const league = leagueById.get(String(group._id.league));
        const game = gameById.get(String(group.games[0]));
        const team = (group._id.side === "B" ? game?.teamB?.name : game?.teamA?.name) || "";
        const key = `${group._id.league}|${team}`;
        const row = entry.rows.get(key) || { league: league?.name || "", season: league?.season?.name || "", team, games: 0 };
        row.games += group.games.length;
        entry.rows.set(key, row);
    }
    playGames.flat().forEach((group) => {
        const entry = out.get(String(group._id));
        if (entry) group.games.forEach((g) => entry.gameIds.add(String(g)));
    });

    const result = new Map();
    for (const [id, entry] of out) {
        const all = [...entry.rows.values()].sort((a, b) =>
            seasonSortKey(a.season) - seasonSortKey(b.season) || a.team.localeCompare(b.team) || a.league.localeCompare(b.league));
        result.set(id, {
            games: entry.gameIds.size,
            rows: all.slice(0, HISTORY_ROW_LIMIT),
            more: Math.max(0, all.length - HISTORY_ROW_LIMIT),
            latest: all[all.length - 1] || null,
        });
    }
    return result;
}

async function gameRowsFor(playerIds) {
    const ids = playerIds.map(oid);
    const [lines, gameStats, plays] = await Promise.all([
        ImportedStatLine.find({ player: { $in: ids } }).select("player game").lean(),
        GameStat.find({ player: { $in: ids } }).select("player game").lean(),
        Play.find({ $or: FROZEN_PLAYER_FIELDS.map((f) => ({ [f]: { $in: ids } })) })
            .select(["game", ...FROZEN_PLAYER_FIELDS].join(" ")).lean(),
    ]);
    const idSet = new Set(playerIds.map(String));
    const playRows = plays.flatMap((p) =>
        // One row per record per play; a play naming two of the records
        // (e.g. one passes to the other) shows they're different people.
        [...new Set(FROZEN_PLAYER_FIELDS.map((f) => p[f] && String(p[f])).filter((v) => v && idSet.has(v)))]
            .map((player) => ({ player, game: p.game }))
    );
    // Duplicates within one player are fine; findSharedGames dedupes per game.
    return [...lines, ...gameStats, ...playRows];
}

/**
 * Check a merge without changing anything.
 * @returns {Promise<{ target, sources, blockers: string[], sharedGames: Array<{ game: string, players: string[] }>, histories: Map }>}
 */
export async function previewMerge(targetId, sourceIds) {
    const [target, sources, rostered] = await Promise.all([
        Player.findById(targetId).select("name organization status user photo").lean(),
        Player.find({ _id: { $in: sourceIds.map(oid) } }).select("name organization status user photo").lean(),
        Team.distinct("players.player", { "players.player": { $in: sourceIds.map(oid) } }),
    ]);
    const found = new Set(sources.map((s) => String(s._id)));
    const blockers = mergeBlockers({
        target,
        sources,
        missingSourceIds: sourceIds.filter((id) => !found.has(String(id))),
        rosteredSourceIds: new Set(rostered.map(String)),
    });

    const allIds = [targetId, ...sourceIds];
    const [sharedGames, histories] = await Promise.all([
        gameRowsFor(allIds).then(findSharedGames),
        playerHistories(allIds),
    ]);
    if (sharedGames.length) {
        blockers.push(
            `${sharedGames.length} game${sharedGames.length === 1 ? " has" : "s have"} stats for more than one of these records — ` +
            "one person can't play twice in the same game, so they're different players"
        );
    }
    return { target, sources, blockers, sharedGames, histories };
}

const emptyRefs = () => ({ statLines: [], gameStats: [], awards: [], retired: [], registryRows: [], plays: {} });

// A merge that became invalid between the preview and the write.
class MergeBlockedError extends Error {}

// Every row that points at one of `sourceIds`, grouped by source player.
// Sequential on purpose: operations inside one transaction must not overlap.
async function collectRefs(sourceIds, session) {
    const ids = sourceIds.map(oid);
    const refs = new Map(sourceIds.map((id) => [String(id), emptyRefs()]));
    const add = (playerId, key, rowId) => refs.get(String(playerId))?.[key].push(rowId);

    for (const [Model, key] of [[ImportedStatLine, "statLines"], [GameStat, "gameStats"], [Award, "awards"]]) {
        const rows = await Model.find({ player: { $in: ids } }).select("player").session(session).lean();
        rows.forEach((r) => add(r.player, key, r._id));
    }
    // Retired numbers are recorded per team AND number, so undo hands back
    // exactly the entries that moved — not every entry the kept player holds.
    const teams = await Team.find({ "retiredNumbers.player": { $in: ids } })
        .select("retiredNumbers.player retiredNumbers.jerseyNumber").session(session).lean();
    teams.forEach((t) => {
        const byPlayer = new Map();
        t.retiredNumbers.forEach((r) => {
            const playerId = r.player && String(r.player);
            if (!playerId || !refs.has(playerId)) return;
            if (!byPlayer.has(playerId)) byPlayer.set(playerId, []);
            byPlayer.get(playerId).push(r.jerseyNumber);
        });
        byPlayer.forEach((jerseyNumbers, playerId) => add(playerId, "retired", { team: t._id, jerseyNumbers }));
    });
    const registry = await mongoose.connection.collection(LEGACY_REGISTRY)
        .find({ entity: "player", docId: { $in: ids } }, { projection: { docId: 1 }, session }).toArray();
    registry.forEach((r) => add(r.docId, "registryRows", r._id));
    const plays = await Play.find({ $or: FROZEN_PLAYER_FIELDS.map((f) => ({ [f]: { $in: ids } })) })
        .select(FROZEN_PLAYER_FIELDS.join(" ")).session(session).lean();
    plays.forEach((p) => {
        FROZEN_PLAYER_FIELDS.forEach((field) => {
            const entry = p[field] && refs.get(String(p[field]));
            if (entry) (entry.plays[field] ||= []).push(p._id);
        });
    });
    return refs;
}

// One bulk write per collection: for each (refs, from, to) move, point the
// recorded rows from `from` to `to`. Filtering on the current value as well
// as the row id means a row someone changed since is left alone.
async function repoint(moves, session) {
    const ops = { statLines: [], gameStats: [], awards: [], plays: [], teams: [], registry: [] };
    for (const { refs, from: fromId, to: toId } of moves) {
        const from = oid(fromId);
        const to = oid(toId);
        const move = (list, ids, filter, update) => {
            if (ids.length) list.push({ updateMany: { filter: { _id: { $in: ids }, ...filter }, update } });
        };
        move(ops.statLines, refs.statLines, { player: from }, { $set: { player: to } });
        move(ops.gameStats, refs.gameStats, { player: from }, { $set: { player: to } });
        move(ops.awards, refs.awards, { player: from }, { $set: { player: to } });
        for (const [field, playIds] of Object.entries(refs.plays || {})) {
            if (FROZEN_PLAYER_FIELDS.includes(field)) move(ops.plays, playIds, { [field]: from }, { $set: { [field]: to } });
        }
        for (const { team, jerseyNumbers } of refs.retired || []) {
            ops.teams.push({ updateOne: {
                filter: { _id: team },
                update: { $set: { "retiredNumbers.$[r].player": to }, $inc: { __v: 1 } },
                arrayFilters: [{ "r.player": from, "r.jerseyNumber": { $in: jerseyNumbers } }],
            } });
        }
        move(ops.registry, refs.registryRows, { docId: from }, { $set: { docId: to } });
    }
    const targets = [
        [ImportedStatLine, ops.statLines], [GameStat, ops.gameStats], [Award, ops.awards],
        [Play, ops.plays], [Team, ops.teams],
    ];
    // Model.bulkWrite keeps Mongoose's updatedAt stamping, which is what tells
    // the stats caches (dataFingerprint.js) that these rows changed.
    for (const [Model, list] of targets) {
        if (list.length) await Model.bulkWrite(list, { session, ordered: true });
    }
    if (ops.registry.length) {
        await mongoose.connection.collection(LEGACY_REGISTRY).bulkWrite(ops.registry, { session, ordered: true });
    }
}

const actorOrNull = (actorId) => (actorId && mongoose.isValidObjectId(actorId) ? actorId : null);

/**
 * Merge `sourceIds` into `targetId` in one transaction.
 * @returns {Promise<{ ok: true, mergeId: string, merged: number } | { ok: false, status: number, error: string, blockers?: string[] }>}
 */
export async function mergePlayers({ targetId, sourceIds, actorId = null }) {
    const preview = await previewMerge(targetId, sourceIds);
    if (preview.blockers.length) {
        return { ok: false, status: 409, error: preview.blockers[0], blockers: preview.blockers };
    }

    let mergeId;
    try {
        mergeId = await inTransaction(async (session) => {
            // Re-check inside the transaction: the preview ran outside it.
            // Touching the kept player also makes a concurrent delete of it
            // conflict with this transaction instead of slipping past.
            const kept = await Player.updateOne(
                { _id: oid(targetId) },
                { $currentDate: { updatedAt: true } },
                { session, timestamps: false }
            );
            if (kept.matchedCount !== 1) throw new MergeBlockedError("The player to keep no longer exists");
            const players = await Player.find({ _id: { $in: sourceIds.map(oid) } }).session(session).lean();
            const found = new Set(players.map((p) => String(p._id)));
            const rostered = await Team.distinct("players.player", { "players.player": { $in: sourceIds.map(oid) } }).session(session);
            const blockers = mergeBlockers({
                target: preview.target,
                sources: players,
                missingSourceIds: sourceIds.filter((id) => !found.has(String(id))),
                rosteredSourceIds: new Set(rostered.map(String)),
            });
            if (blockers.length) throw new MergeBlockedError(blockers[0]);
            const refs = await collectRefs(sourceIds, session);
            await repoint(players.map((p) => ({ refs: refs.get(String(p._id)), from: p._id, to: targetId })), session);
            await Player.deleteMany({ _id: { $in: sourceIds.map(oid) } }, { session });
            const [log] = await PlayerMerge.create([{
                organization: preview.target.organization || null,
                target: preview.target._id,
                targetName: preview.target.name,
                mergedBy: actorOrNull(actorId),
                sources: players.map((player) => ({ player, ...refs.get(String(player._id)) })),
            }], { session });
            return String(log._id);
        });
    } catch (error) {
        if (error instanceof MergeBlockedError) return { ok: false, status: 409, error: error.message, blockers: [error.message] };
        throw error;
    }

    return { ok: true, mergeId, merged: sourceIds.length };
}

/**
 * Reverse a merge: restore the original player records and point every row
 * that was moved back at them.
 * @returns {Promise<{ ok: true, restored: number } | { ok: false, status: number, error: string }>}
 */
export async function undoMerge({ mergeId, actorId = null }) {
    if (!mongoose.isValidObjectId(mergeId)) return { ok: false, status: 400, error: "Invalid merge" };
    const log = await PlayerMerge.findById(mergeId).lean();
    if (!log) return { ok: false, status: 404, error: "Merge not found" };
    if (log.undone) return { ok: false, status: 409, error: "This merge was already undone" };
    if (!(await Player.exists({ _id: log.target }))) {
        return { ok: false, status: 409, error: `${log.targetName || "The kept player"} was itself merged or removed later — undo that first` };
    }

    const sourceIds = log.sources.map((s) => s.player._id);
    if (await Player.exists({ _id: { $in: sourceIds } })) {
        return { ok: false, status: 409, error: "Some of these records already exist again — nothing was changed" };
    }

    await inTransaction(async (session) => {
        const claimed = await PlayerMerge.updateOne(
            { _id: log._id, undone: false },
            { $set: { undone: true, undoneAt: new Date(), undoneBy: actorOrNull(actorId) } },
            { session }
        );
        if (claimed.modifiedCount !== 1) throw new Error("This merge was already undone");
        await Player.collection.insertMany(log.sources.map((s) => s.player), { session });
        await repoint(log.sources.map((s) => ({ refs: s, from: log.target, to: s.player._id })), session);
    });
    return { ok: true, restored: log.sources.length };
}

/**
 * Merges into `targetId` that can still be undone, newest first.
 * @returns {Promise<Array<{ _id: string, createdAt: Date, names: string[] }>>}
 */
export async function listMergesInto(targetId, limit = 20) {
    const logs = await PlayerMerge.find({ target: oid(targetId), undone: false })
        .select("createdAt sources.player.name")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    return logs.map((l) => ({ _id: String(l._id), createdAt: l.createdAt, names: l.sources.map((src) => src.player?.name || "") }));
}

/**
 * What tells two same-named players apart in a search list: the teams they're
 * on now, and the last team/season they have stats for.
 * @param {Array<{ _id: unknown }>} players
 * @returns {Promise<Map<string, { currentTeams: string[], games: number, lastTeam: string, lastSeason: string }>>}
 */
export async function playerIdentifiers(players) {
    const ids = players.map((p) => String(p._id));
    if (!ids.length) return new Map();
    const [teams, histories] = await Promise.all([
        Team.find({ "players.player": { $in: ids.map(oid) } }).select("name players.player").lean(),
        playerHistories(ids),
    ]);
    const teamNames = new Map(ids.map((id) => [id, new Set()]));
    teams.forEach((t) => t.players.forEach((p) => teamNames.get(String(p.player))?.add(t.name)));
    return new Map(ids.map((id) => {
        const history = histories.get(id);
        return [id, {
            currentTeams: [...(teamNames.get(id) || [])].sort(),
            games: history?.games || 0,
            lastTeam: history?.latest?.team || "",
            lastSeason: history?.latest?.season || "",
        }];
    }));
}
