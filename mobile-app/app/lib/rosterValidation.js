/**
 * Validates if a player number exists in the team roster for the current game.
 * @param {string} playerNumber - The jersey number entered by the user
 * @param {Array} teamRoster - Array of { jerseyNumber, playerName, playerId }
 * @returns {{ valid: boolean, playerName: string|null }}
 */
export function validatePlayerNumber(playerNumber, teamRoster) {
    if (!playerNumber || !teamRoster || teamRoster.length === 0) {
        return { valid: true, playerName: null }; // No roster data = skip validation
    }
    const num = Number(playerNumber);
    if (isNaN(num)) return { valid: true, playerName: null };
    const match = teamRoster.find((p) => p.jerseyNumber === num);
    if (match) return { valid: true, playerName: match.playerName };
    return { valid: false, playerName: null };
}

/**
 * Returns true if ANY of the given player number entries are invalid
 * (i.e. non-empty and not found in their respective roster).
 * Each entry is { value, roster } where value is the input string
 * and roster is the team roster array to validate against.
 */
export function hasInvalidPlayerNumbers(entries) {
    for (const { value, roster } of entries) {
        if (value && value.toString().trim() !== "" && roster && roster.length > 0) {
            const result = validatePlayerNumber(value, roster);
            if (!result.valid) return true;
        }
    }
    return false;
}

/**
 * Returns the roster for the given team side.
 * @param {object} roster - { teamA: [...], teamB: [...] }
 * @param {"A"|"B"} team - Which team side
 * @returns {Array}
 */
export function getTeamRoster(roster, team) {
    if (!roster) return [];
    return team === "A" ? roster.teamA || [] : roster.teamB || [];
}
