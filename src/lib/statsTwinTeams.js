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
    // `active` is carried over too — dropping it (as this used to) turned
    // every player deactivated on the real team (e.g. unpaid) back into an
    // active one on the twin, so they could be recorded in the scrimmage,
    // and an inactive/active pair sharing a number became two ACTIVE
    // players on one number, with plays landing on whichever was found first.
    const players = (realTeam.players || []).map((p) => ({
        player: p.player,
        jerseyNumber: p.jerseyNumber,
        active: p.active !== false,
    }));

    // Scoped to this league too — two unrelated real teams can share a name
    // across different leagues (e.g. a "Warriors" in Chino and a different
    // "Warriors" in Temecula), and without the league scope here their
    // "Warriors STATS" twins would collide and steal each other's roster.
    const existingTwin = await Team.findOne({ organization: realTeam.organization, name: twinName, "leagues.league": leagueId }).select("_id logo").lean();

    if (!existingTwin) {
        return Team.create({
            organization: realTeam.organization,
            name: twinName,
            logo: realTeam.logo || "",
            players,
            leagues: [{ league: leagueId }],
        });
    }

    // Single atomic update (the twin was found BY this league, so its
    // membership is already there). Bumps __v like every other roster
    // write, so a stale Manage Players save on the twin can't overwrite this
    // re-sync (see teamJerseyGuard.js) — without a read-modify-save that two
    // simultaneous No Stats starts could trip over.
    return Team.findByIdAndUpdate(
        existingTwin._id,
        { $set: { players, logo: realTeam.logo || existingTwin.logo }, $inc: { __v: 1 } },
        { new: true }
    );
}
