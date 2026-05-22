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
        .select("location league")
        .populate("league", "location locations")
        .lean();

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
    };
}
