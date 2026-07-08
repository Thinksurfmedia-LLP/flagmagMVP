import Team from "@/models/Team";
import Player from "@/models/Player";

/**
 * Team.players (roster membership) and Player.status/presentTeam are two
 * separate places that must be kept in sync manually. If a write is
 * interrupted or races with another concurrent edit, they can drift apart —
 * e.g. a player still listed in a team's roster while their own Player
 * document still says status: "free_agent" (or vice versa).
 *
 * This reconciles the two by treating actual team roster membership as the
 * source of truth and correcting any Player doc whose status disagrees with it.
 *
 * @param {string[]|null} playerIds - Optional scope to only reconcile specific
 *   player IDs (e.g. right after editing one player/team). Pass null/omit to
 *   reconcile every player.
 * @returns {Promise<number>} number of Player documents corrected
 */
export async function reconcilePlayerStatuses(playerIds = null) {
    const teamFilter = playerIds ? { "players.player": { $in: playerIds } } : {};
    const teams = await Team.find(teamFilter).select("name logo players").lean();

    // Map of playerId (string) -> { name, logo } for whichever team they're on
    // (first match wins if somehow rostered on multiple teams).
    const rosterMap = new Map();
    for (const team of teams) {
        for (const entry of team.players || []) {
            if (!entry.player) continue;
            const key = String(entry.player);
            if (!rosterMap.has(key)) {
                rosterMap.set(key, { name: team.name, logo: team.logo || "" });
            }
        }
    }

    const playerFilter = playerIds ? { _id: { $in: playerIds } } : {};
    const candidates = await Player.find(playerFilter).select("status presentTeam").lean();

    const bulkOps = [];
    for (const p of candidates) {
        const rosterTeam = rosterMap.get(String(p._id));
        if (rosterTeam && p.status !== "player") {
            // Rostered on a team but status says otherwise — correct it.
            bulkOps.push({
                updateOne: {
                    filter: { _id: p._id },
                    update: { $set: { status: "player", presentTeam: rosterTeam } },
                },
            });
        } else if (!rosterTeam && p.status === "player") {
            // Marked as a player but not actually on any team's roster.
            bulkOps.push({
                updateOne: {
                    filter: { _id: p._id },
                    update: { $set: { status: "free_agent", presentTeam: { name: "", logo: "" } } },
                },
            });
        }
    }

    if (bulkOps.length > 0) {
        await Player.bulkWrite(bulkOps, { ordered: false }).catch(() => {});
    }

    return bulkOps.length;
}
