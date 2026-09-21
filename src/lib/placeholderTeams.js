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
    // Word-boundary match — a plain .includes("winner") also matched real
    // team names that merely CONTAIN "winner"/"loser" as a substring (e.g.
    // "Breadwinners"), wrongly flagging them as an unresolved bracket slot
    // and blocking the statistician from starting the game.
    return (
        n === "tbd" ||
        n === "to be decided" ||
        /\bwinners?\b/.test(n) ||
        /\blosers?\b/.test(n)
    );
}

/**
 * Bootstraps the default placeholder teams for an organization the FIRST
 * time it has none at all. Deliberately a one-time seed, not a perpetual
 * sync — once an org has any isPlaceholder team, organizers can freely
 * rename or delete them via /api/placeholder-teams without this silently
 * re-creating whatever they just renamed or removed.
 *
 * @param {string|ObjectId} organizationId
 */
export async function ensurePlaceholderTeams(organizationId) {
    const alreadySeeded = await Team.exists({ organization: organizationId, isPlaceholder: true });
    if (alreadySeeded) return;

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
