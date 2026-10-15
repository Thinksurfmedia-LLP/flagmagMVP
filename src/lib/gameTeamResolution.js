// Pure rules for linking a Game's teamA/teamB back to the Team it refers to.
// CommonJS + dependency-free so it runs under `node --test`; the DB-backed
// wrappers live in gameTeams.js.
//
// Why this exists: Team names are NOT unique per organization — two
// unrelated franchises can share a name across leagues (e.g. a "Trojans" in
// SD Thu and a different "Trojans" in Temecula). Games used to carry only a
// denormalized name/logo snapshot, and several routes resolved "the team" via
// an org-wide name map, so whichever same-named team loaded last won — the
// SD Thu Trojans showed the Temecula Trojans' logo on the public schedule.
//
// Resolution order for one side of a game:
//   1. side.teamId — the authoritative link (survives renames).
//   2. a team in THIS game's league with that name — names are unique within
//      a league (enforced by POST /api/leagues/[id]/teams), so this is
//      unambiguous. Covers games written before teamId existed.
//   3. an org placeholder team with that name ("TBD", "Winner of …") —
//      placeholders belong to no league.

const key = (value) => (value == null ? "" : String(value));
const leagueNameKey = (leagueId, name) => `${key(leagueId)}::${name}`;

/**
 * Index an organization's teams for O(1) game-side resolution.
 * @param {Array<{_id, name, leagues?, isPlaceholder?}>} teams
 */
function buildTeamIndex(teams) {
    const byId = new Map();
    const byLeagueAndName = new Map();
    const placeholderByName = new Map();
    for (const team of teams || []) {
        byId.set(key(team._id), team);
        for (const membership of team.leagues || []) {
            if (membership?.league) byLeagueAndName.set(leagueNameKey(membership.league, team.name), team);
        }
        if (team.isPlaceholder) placeholderByName.set(team.name, team);
    }
    return { byId, byLeagueAndName, placeholderByName };
}

/** True when `team` is a legitimate occupant of a game in `leagueId`. */
function belongsToLeague(team, leagueId) {
    if (team.isPlaceholder) return true;
    return (team.leagues || []).some((m) => key(m?.league) === key(leagueId));
}

/** League + name lookup only (no teamId) — used for writes and backfill. */
function resolveByLeagueAndName(name, leagueId, index) {
    if (!name) return null;
    return index.byLeagueAndName.get(leagueNameKey(leagueId, name)) || index.placeholderByName.get(name) || null;
}

/**
 * The Team a game side refers to, or null.
 * @param {{teamId?, name?}|undefined} side
 */
function resolveGameSide(side, leagueId, index) {
    if (!side) return null;
    if (side.teamId) {
        const linked = index.byId.get(key(side.teamId));
        if (linked) return linked;
    }
    return resolveByLeagueAndName(side.name, leagueId, index);
}

/**
 * On a game update, the teamId a side should keep without re-resolving, or
 * undefined. Kept only when the side's name AND league are unchanged — the
 * stored name can be stale after a team rename, and re-sending it on an
 * unrelated edit must not unlink (or re-link) the team.
 */
function teamIdToKeep(existing, side, name, leagueId) {
    const current = existing?.[`team${side}`];
    if (!current?.teamId || current.name !== name) return undefined;
    if (key(existing.league) !== key(leagueId)) return undefined;
    return current.teamId;
}

/** A team's playoff seed for this specific league membership, or null. */
function seedNumberFor(team, leagueId) {
    if (!team) return null;
    const membership = (team.leagues || []).find((m) => key(m?.league) === key(leagueId));
    return membership?.seedNumber ?? null;
}

function enrichSide(side, team, leagueId, { isPlayoffs, withDetails }) {
    const enriched = {
        ...side,
        teamId: team?._id ?? side?.teamId ?? null,
        logo: team?.logo || side?.logo || "",
        seedNumber: isPlayoffs ? seedNumberFor(team, leagueId) : null,
    };
    if (withDetails && team) enriched.details = team;
    return enriched;
}

/**
 * Returns a copy of `game` with each side's teamId, current logo and (for
 * playoffs leagues) seed number filled in from the Team it refers to. The
 * stored name/score are left as-is.
 *
 * @param {object} game  lean Game
 * @param {ReturnType<typeof buildTeamIndex>} index
 * @param {{isPlayoffs?: boolean, withDetails?: boolean}} [options]
 */
function enrichGameTeams(game, index, { isPlayoffs = false, withDetails = false } = {}) {
    const opts = { isPlayoffs, withDetails };
    return {
        ...game,
        teamA: enrichSide(game.teamA, resolveGameSide(game.teamA, game.league, index), game.league, opts),
        teamB: enrichSide(game.teamB, resolveGameSide(game.teamB, game.league, index), game.league, opts),
    };
}

/**
 * Works out which games need teamA/teamB.teamId written. Prefers the
 * Schedule entry's team1/team2 ids (the admin picked those by id), but only
 * when that team actually matches the game's stored name and league —
 * otherwise falls back to league + name.
 *
 * @param {Array<object>} games  lean Games
 * @param {ReturnType<typeof buildTeamIndex>} index
 * @param {Map<string, {team1?, team2?}>} scheduleTeamsByGame  gameId → schedule ids
 */
function planTeamIdBackfill(games, index, scheduleTeamsByGame = new Map()) {
    const updates = [];
    const unresolved = [];
    let alreadyLinked = 0;

    for (const game of games) {
        const gameId = key(game._id);
        const scheduled = scheduleTeamsByGame.get(gameId) || {};
        const set = {};
        const sources = {};

        for (const [side, scheduleId] of [["A", scheduled.team1], ["B", scheduled.team2]]) {
            const current = game[`team${side}`];
            if (!current?.name) continue;
            if (current.teamId) {
                alreadyLinked++;
                continue;
            }

            const fromSchedule = scheduleId ? index.byId.get(key(scheduleId)) : null;
            const scheduleMatches = fromSchedule && fromSchedule.name === current.name && belongsToLeague(fromSchedule, game.league);
            const team = scheduleMatches ? fromSchedule : resolveByLeagueAndName(current.name, game.league, index);

            if (!team) {
                unresolved.push({ gameId, side, name: current.name, league: key(game.league) });
                continue;
            }
            set[`team${side}.teamId`] = team._id;
            sources[side] = scheduleMatches ? "schedule" : "league+name";
        }

        if (Object.keys(set).length > 0) updates.push({ gameId, set, sources });
    }

    return { updates, unresolved, alreadyLinked };
}

module.exports = {
    buildTeamIndex,
    resolveByLeagueAndName,
    resolveGameSide,
    teamIdToKeep,
    seedNumberFor,
    enrichGameTeams,
    planTeamIdBackfill,
};
