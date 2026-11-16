import Team from "@/models/Team";

// Each player's roster memberships, looked up in one query for a whole page
// of players. Player list screens used to download every team with every
// roster (several MB, ~30s for XFlag) only to work this out in the browser.

const byTeamName = (a, b) => String(a.teamName).localeCompare(String(b.teamName));

/**
 * @param {Array<{ _id: any }>} players lean player docs
 * @returns {Promise<Array<object>>} new player objects, each with
 *   `rosterTeams: [{ teamId, teamName, jerseyNumber, isPlaceholder }]` (A–Z)
 *   and `jerseyNumber` (the number on one of their teams, or null — the
 *   field these lists have always returned)
 */
export async function withRosterTeams(players) {
    const playerIds = players.map((p) => p._id);
    if (playerIds.length === 0) return [];
    const teams = await Team.find({ "players.player": { $in: playerIds } })
        .select("name isPlaceholder players.player players.jerseyNumber")
        .lean();

    const jerseyById = {};
    const teamsById = {};
    for (const team of teams) {
        for (const member of team.players || []) {
            if (!member.player) continue;
            const pid = member.player.toString();
            jerseyById[pid] = member.jerseyNumber;
            (teamsById[pid] ||= []).push({
                teamId: String(team._id),
                teamName: team.name,
                jerseyNumber: member.jerseyNumber,
                isPlaceholder: Boolean(team.isPlaceholder),
            });
        }
    }

    return players.map((p) => {
        const pid = p._id.toString();
        return {
            ...p,
            jerseyNumber: jerseyById[pid] || null,
            rosterTeams: (teamsById[pid] || []).sort(byTeamName),
        };
    });
}
