import Team from "@/models/Team";

/**
 * Find-or-create the "<Team Name> STATS" twin of a real team, used for the
 * live scrimmage side of a No Stats Game (see start-no-stats-game/route.js)
 * — same roster as the real team, so plays still resolve to real players,
 * but a visibly distinct team identity for the one-off fixture. Reused
 * across repeated forfeits so a league doesn't accumulate "Name STATS",
 * "Name STATS (2)", etc. — the roster is re-synced to the real team's
 * CURRENT roster every time, since players may have joined/left since the
 * twin was last used.
 *
 * @param {Object} realTeam - lean or hydrated Team document (organization, name, logo, players)
 * @param {ObjectId|string} leagueId
 * @returns {Promise<{_id, name, logo}>}
 */
export async function findOrCreateStatsTwin(realTeam, leagueId) {
    const twinName = `${realTeam.name} STATS`;
    const players = (realTeam.players || []).map((p) => ({
        player: p.player,
        jerseyNumber: p.jerseyNumber,
    }));

    const existingTwin = await Team.findOne({ organization: realTeam.organization, name: twinName });

    if (!existingTwin) {
        return Team.create({
            organization: realTeam.organization,
            name: twinName,
            logo: realTeam.logo || "",
            players,
            leagues: [{ league: leagueId }],
        });
    }

    existingTwin.players = players;
    existingTwin.logo = realTeam.logo || existingTwin.logo;
    const alreadyInLeague = (existingTwin.leagues || []).some((m) => String(m.league) === String(leagueId));
    if (!alreadyInLeague) existingTwin.leagues.push({ league: leagueId });
    await existingTwin.save();
    return existingTwin;
}
