import Team from "@/models/Team";

/**
 * System-level placeholder team names available in every organization.
 * Used when a game fixture opponent is not yet known (e.g. knockout brackets).
 */
export const PLACEHOLDER_TEAM_NAMES = [
    "TBD",
    "Winner",
    "Losers",
    "D1 Semi",
    "D1 Championship",
    "D2 Semi",
    "D2 Championship",
    "D3 Semi",
    "D3 Championship",
    "D4 Championship",
];

/**
 * Heuristic match for a team NAME (not the isPlaceholder flag) that identifies
 * an unresolved bracket slot, e.g. on a Game's denormalized teamA/teamB.name
 * where there's no Team ref to check isPlaceholder against directly.
 *
 * @param {string} name
 */
export function isPlaceholderTeamName(name) {
    if (!name || !String(name).trim()) return true;
    const n = String(name).trim().toLowerCase();
    return (
        n === "tbd" ||
        n === "to be decided" ||
        n.includes("winner") ||
        n.includes("loser")
    );
}

/**
 * Ensures the placeholder teams exist for the given organization and are
 * flagged isPlaceholder. Safe to call repeatedly — uses upsert so it never
 * creates duplicates, and backfills the flag onto any team that was already
 * created by hand under one of these names (the org/name pair is unique, so
 * the upsert alone would otherwise silently no-op on those and leave them
 * unflagged).
 *
 * @param {string|ObjectId} organizationId
 */
export async function ensurePlaceholderTeams(organizationId) {
    const ops = PLACEHOLDER_TEAM_NAMES.map((name) => ({
        updateOne: {
            filter: { organization: organizationId, name },
            update: {
                $set: { isPlaceholder: true },
                $setOnInsert: {
                    name,
                    organization: organizationId,
                    logo: "",
                    description: "",
                    division: "",
                    coachName: "",
                    coachPhone: "",
                    location: {},
                    season: null,
                    league: null,
                    leagues: [],
                    players: [],
                },
            },
            upsert: true,
        },
    }));

    await Team.bulkWrite(ops);
}
