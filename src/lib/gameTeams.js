import Team from "@/models/Team";
import League from "@/models/League";
import { buildTeamIndex, resolveByLeagueAndName, resolveGameSide, teamIdToKeep, enrichGameTeams } from "@/lib/gameTeamResolution";

// DB-backed helpers around gameTeamResolution.js — the ONE place game routes
// go from a Game's teamA/teamB to the Team it refers to (reads), and the one
// place they stamp teamA/teamB.teamId (writes). Never build an org-wide
// name → team map: same-named teams in different leagues collide.

const INDEX_FIELDS = "name logo leagues isPlaceholder";

/**
 * Loads every team in an organization into a resolution index.
 * @param {string|import("mongoose").Types.ObjectId} organizationId
 * @param {{fullDocs?: boolean}} [options] fullDocs: load whole Team docs
 *   (for callers that expose them as `details`).
 */
export async function loadTeamIndex(organizationId, { fullDocs = false } = {}) {
    const query = Team.find({ organization: organizationId });
    if (!fullDocs) query.select(INDEX_FIELDS);
    return buildTeamIndex(await query.lean());
}

/**
 * Returns copies of `games` with each side's teamId, current team logo and
 * (playoffs leagues only) seed number filled in.
 *
 * @param {Array<object>} games  lean Games, all from `organizationId`
 * @param {string|import("mongoose").Types.ObjectId} organizationId
 * @param {{isPlayoffs?: (game: object) => boolean, withDetails?: boolean}} [options]
 */
export async function enrichGamesWithTeams(games, organizationId, { isPlayoffs = () => false, withDetails = false } = {}) {
    if (!games.length) return [];
    const index = await loadTeamIndex(organizationId, { fullDocs: withDetails });
    return games.map((game) => enrichGameTeams(game, index, { isPlayoffs: isPlayoffs(game), withDetails }));
}

/**
 * The Team docs (lean, players populated with name/photo) occupying both
 * sides of one game: by teamId, falling back to a name match within the
 * game's league for games written before teamId existed.
 *
 * @returns {Promise<{teamA: object|null, teamB: object|null}>}
 */
export async function findGameTeamsWithPlayers(game, organizationId) {
    const ids = [game.teamA?.teamId, game.teamB?.teamId].filter(Boolean);
    const legacyNames = [game.teamA, game.teamB].filter((s) => s?.name && !s.teamId).map((s) => s.name);
    const or = [];
    if (ids.length) or.push({ _id: { $in: ids } });
    if (legacyNames.length) or.push({ organization: organizationId, name: { $in: legacyNames }, "leagues.league": game.league });
    if (or.length === 0) return { teamA: null, teamB: null };

    const teams = await Team.find({ $or: or }).populate("players.player", "name photo").lean();
    const index = buildTeamIndex(teams);
    return {
        teamA: resolveGameSide(game.teamA, game.league, index),
        teamB: resolveGameSide(game.teamB, game.league, index),
    };
}

/**
 * name → Team _id for teams that can occupy a game in `leagueId`: members of
 * that league, plus the org's placeholder teams ("TBD", …). Names are unique
 * within a league, so each name maps to at most one team.
 *
 * @returns {Promise<Map<string, import("mongoose").Types.ObjectId>>}
 */
export async function resolveTeamIdsByName(leagueId, names) {
    const wanted = [...new Set((names || []).filter(Boolean))];
    if (!leagueId || wanted.length === 0) return new Map();

    const league = await League.findById(leagueId).select("organization").lean();
    if (!league?.organization) return new Map();

    const teams = await Team.find({
        organization: league.organization,
        name: { $in: wanted },
        $or: [{ "leagues.league": leagueId }, { isPlaceholder: true }],
    }).select(INDEX_FIELDS).lean();

    const index = buildTeamIndex(teams);
    const ids = new Map();
    for (const name of wanted) {
        const team = resolveByLeagueAndName(name, leagueId, index);
        if (team) ids.set(name, team._id);
    }
    return ids;
}

/**
 * Returns a copy of a Game create/update payload with teamA/teamB.teamId set
 * from the side's name within `leagueId`. Handles both object form
 * (`teamA: { name, … }`) and dot-notation (`"teamA.name": …`). The id is
 * always derived server-side — a client-supplied teamId is overwritten, so
 * a game can never be linked to a team outside its league. A name with no
 * matching team gets teamId: null.
 *
 * For updates, pass the stored game as `existing`: a side whose name (and
 * league) is unchanged keeps its existing teamId instead of being re-resolved
 * by name — the stored name can be stale after a team rename, and re-sending
 * it on an unrelated edit (date, score, …) must not unlink the team.
 */
export async function withResolvedTeamIds(payload, leagueId, existing = null) {
    const keptId = (side, name) => teamIdToKeep(existing, side, name, leagueId);

    const nameA = payload.teamA?.name ?? payload["teamA.name"];
    const nameB = payload.teamB?.name ?? payload["teamB.name"];
    const toResolve = [
        nameA && keptId("A", nameA) === undefined ? nameA : null,
        nameB && keptId("B", nameB) === undefined ? nameB : null,
    ];
    if (!nameA && !nameB) return payload;

    const ids = await resolveTeamIdsByName(leagueId, toResolve);
    const idFor = (side, name) => keptId(side, name) ?? ids.get(name) ?? null;
    const next = { ...payload };

    if (payload.teamA?.name) next.teamA = { ...payload.teamA, teamId: idFor("A", payload.teamA.name) };
    if (payload.teamB?.name) next.teamB = { ...payload.teamB, teamId: idFor("B", payload.teamB.name) };
    if (payload["teamA.name"]) next["teamA.teamId"] = idFor("A", payload["teamA.name"]);
    if (payload["teamB.name"]) next["teamB.teamId"] = idFor("B", payload["teamB.name"]);
    return next;
}
