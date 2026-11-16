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
    const rosterMap = buildRosterMap(teams);

    const playerFilter = playerIds ? { _id: { $in: playerIds } } : {};
    const candidates = await Player.find(playerFilter).select("status presentTeam").lean();

    return applyStatusFixes(rosterMap, candidates);
}

/**
 * Same result as reconcilePlayerStatuses(<every player id in the org>) — or
 * reconcilePlayerStatuses() for every org when orgId is null — but only
 * loads players that can actually be out of sync. The old way sent all
 * of an org's player ids (~55k for XFlag after the legacy import) as one
 * `$in` list and loaded every one of those players, every few minutes while
 * anyone had a player list open.
 * @returns {Promise<number>} number of Player documents corrected
 */
export async function reconcileOrgPlayerStatuses(orgId = null) {
    // Rosters across ALL orgs — someone in this org can be on another org's team.
    const teams = await Team.find({ "players.0": { $exists: true } }).select("name logo players.player").lean();
    const rosterMap = buildRosterMap(teams);
    const rosteredIds = [...rosterMap.keys()];

    // The only two ways to be wrong: marked "player" (maybe on no roster),
    // or on a roster but not marked "player".
    const scope = orgId ? { organization: orgId } : {};
    const [markedPlayers, rosteredNonPlayers] = await Promise.all([
        Player.find({ ...scope, status: "player" }).select("status presentTeam").lean(),
        Player.find({ ...scope, _id: { $in: rosteredIds }, status: { $ne: "player" } }).select("status presentTeam").lean(),
    ]);
    return applyStatusFixes(rosterMap, [...markedPlayers, ...rosteredNonPlayers]);
}

// Map of playerId (string) -> { name, logo } for whichever team they're on
// (first match wins if somehow rostered on multiple teams).
function buildRosterMap(teams) {
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
    return rosterMap;
}

async function applyStatusFixes(rosterMap, candidates) {
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
