// Decides what team data a player-edit save sends to PUT /api/players/[id].
// CommonJS + dependency-free so it runs under `node --test`.
//
// That route treats `teams` as the player's COMPLETE roster list: any team
// left out is removed, and an empty list makes them a free agent. Edit forms
// build the starting list from a separately loaded (slow) team list, so if
// that hadn't loaded, the form opened with no teams and a photo-only save
// wiped every membership (Julian Noble, Inferno #65, 2026-11-13). So:
//   - team data is only sent when the user actually changed the teams, and
//   - never when the form opened before the teams were known, and
//   - emptying the list on purpose is flagged (`removeFromAllTeams`), which
//     the route requires before taking a player off every team.

/** @typedef {{ teamId: string, teamName?: string, jerseyNumber: number|string }} TeamEntry */

function signature(entries) {
    return (entries || [])
        .map((t) => `${String(t.teamId)}:${String(t.jerseyNumber ?? "").trim()}`)
        .sort()
        .join("|");
}

/**
 * @param {{ initial: TeamEntry[], current: TeamEntry[], teamsKnown: boolean }} args
 * @returns {{} | { teams: TeamEntry[], removeFromAllTeams?: true }}
 */
function playerTeamsPayload({ initial, current, teamsKnown }) {
    if (!teamsKnown) return {};
    if (signature(initial) === signature(current)) return {};
    const teams = current || [];
    return teams.length === 0 ? { teams, removeFromAllTeams: true } : { teams };
}

/**
 * Server-side guard: true when `body` would take a player who is on
 * `currentTeamCount` teams off all of them without saying so explicitly.
 */
function wouldRemoveFromAllTeams(body, currentTeamCount) {
    return Array.isArray(body?.teams)
        && body.teams.length === 0
        && body.removeFromAllTeams !== true
        && currentTeamCount > 0;
}

module.exports = { playerTeamsPayload, wouldRemoveFromAllTeams };
