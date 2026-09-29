// Pure rules for "<Team> STATS" No Stats scrimmage teams (see
// statsTwinTeams.js and POST /api/games/[gameId]/start-no-stats-game).
// CommonJS + dependency-free so it runs under `node --test`; re-exported
// from statsAggregation.js for existing importers.

/** True for a No Stats scrimmage twin, e.g. "Members Only STATS". */
function isNoStatsTeamName(name) {
    if (!name) return false;
    return /\bstats$/i.test(name.trim());
}

/**
 * Error message if a forfeit → No Stats Game request can't proceed with these
 * teams, or null if valid. Enforced server-side so no client can, e.g., pick
 * a twin as the stand-in and create a twin of a twin ("X STATS STATS").
 */
function validateNoStatsTeams({ original, league, realTeamDoc, standInTeamDoc }) {
    if (original.noStatsBothSides) {
        return "This is already a No Stats Game — a forfeit can't be turned into another one.";
    }
    if (isNoStatsTeamName(realTeamDoc.name)) {
        return `"${realTeamDoc.name}" is a No Stats scrimmage team and can't start a No Stats Game.`;
    }
    if (isNoStatsTeamName(standInTeamDoc.name)) {
        return `"${standInTeamDoc.name}" is a No Stats scrimmage team — pick a real team as the stand-in.`;
    }
    if (standInTeamDoc.isPlaceholder) {
        return `"${standInTeamDoc.name}" is a placeholder team — pick a real team as the stand-in.`;
    }
    if (String(standInTeamDoc.organization) !== String(league.organization)) {
        return "The stand-in team must belong to the same organization as this game.";
    }
    if (String(standInTeamDoc._id) === String(realTeamDoc._id)) {
        return "The stand-in can't be the team that showed up.";
    }
    const forfeitingName = original.teamA?.name === realTeamDoc.name ? original.teamB?.name : original.teamA?.name;
    if (standInTeamDoc.name === forfeitingName) {
        return "The stand-in can't be the team that forfeited.";
    }
    return null;
}

module.exports = { isNoStatsTeamName, validateNoStatsTeams };
