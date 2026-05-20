import Team from "@/models/Team";

/**
 * System-level placeholder team names available in every organization.
 * Used when a game fixture opponent is not yet known (e.g. knockout brackets).
 */
export const PLACEHOLDER_TEAM_NAMES = ["TBD", "Winner", "Loser"];

/**
 * Ensures the three placeholder teams exist for the given organization.
 * Safe to call multiple times — uses upsert so it never creates duplicates.
 *
 * @param {string|ObjectId} organizationId
 */
export async function ensurePlaceholderTeams(organizationId) {
    const ops = PLACEHOLDER_TEAM_NAMES.map((name) => ({
        updateOne: {
            filter: { organization: organizationId, name },
            update: {
                $setOnInsert: {
                    name,
                    organization: organizationId,
                    isPlaceholder: true,
                    logo: "",
                    description: "",
                    division: "",
                    coachName: "",
                    coachPhone: "",
                    location: {},
                    season: null,
                    league: null,
                    players: [],
                },
            },
            upsert: true,
        },
    }));

    await Team.bulkWrite(ops);
}
