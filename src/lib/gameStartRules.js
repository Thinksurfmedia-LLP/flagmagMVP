// Pure rules for whether a game can be started. CommonJS + dependency-free so
// it runs under `node --test`; the game PUT route feeds it the Team docs.
//
// A game can't start while either side is still an org placeholder team
// ("TBD", "D1 Championship", …) — those are bracket slots, not real teams,
// and are identified by Team.isPlaceholder (names like "D1 Championship"
// don't look like placeholders). Both real teams also need a minimum roster.

const MIN_PLAYERS_TO_START = 4;

/** Players on the team's roster who aren't deactivated for it (Team.players[].active). */
function activePlayerCount(team) {
    return (team?.players || []).filter((p) => p?.active !== false).length;
}

/**
 * @param {{name?}} sideA  the game side (name used in messages)
 * @param {object|null} teamA  the Team doc occupying sideA, or null
 * @returns {{placeholders: string[], shortRosters: string[]}}
 */
function findStartBlockers(sideA, teamA, sideB, teamB) {
    const placeholders = [];
    const shortRosters = [];
    for (const [side, team] of [[sideA, teamA], [sideB, teamB]]) {
        const name = side?.name || team?.name || "";
        if (team?.isPlaceholder) placeholders.push(name);
        else if (activePlayerCount(team) < MIN_PLAYERS_TO_START) shortRosters.push(name);
    }
    return { placeholders, shortRosters };
}

module.exports = { MIN_PLAYERS_TO_START, activePlayerCount, findStartBlockers };
