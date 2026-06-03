import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import Team from "@/models/Team";

/**
 * Fetches a player document and derives the locations where they have played,
 * sourced from the teams they belong to (team.location) and those teams' leagues
 * (league.locations / league.location).
 */
export async function getPlayerWithLocations(id) {
    await dbConnect();
    const player = await Player.findById(id).lean();
    if (!player) return { player: null, derivedLocations: [] };

    const teams = await Team.find({ "players.player": player._id })
        .select("name logo location league players")
        .populate("league", "location locations")
        .lean();

    const presentTeams = teams.map(t => {
        const tp = (t.players || []).find(p => String(p.player) === String(player._id));
        return {
            _id: t._id,
            name: t.name,
            logo: t.logo,
            jerseyNumber: tp?.jerseyNumber
        };
    });

    const locationSet = new Set();

    for (const team of teams) {
        const { cityName, countyName } = team.location || {};
        if (cityName?.trim()) {
            locationSet.add(cityName.trim());
        } else if (countyName?.trim()) {
            locationSet.add(countyName.trim());
        } else if (team.league?.locations?.length) {
            team.league.locations.forEach((l) => { if (l?.trim()) locationSet.add(l.trim()); });
        } else if (team.league?.location?.trim()) {
            locationSet.add(team.league.location.trim());
        }
    }

    return {
        player: JSON.parse(JSON.stringify(player)),
        derivedLocations: [...locationSet].filter(Boolean),
        presentTeams: JSON.parse(JSON.stringify(presentTeams)),
    };
}
