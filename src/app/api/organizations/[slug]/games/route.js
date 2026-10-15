import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Season from "@/models/Season";
import Game from "@/models/Game";
import Schedule from "@/models/Schedule";
import { enrichGamesWithTeams } from "@/lib/gameTeams";

// GET /api/organizations/[slug]/games
// Returns all games across every league for this org in a single round-trip.
// Replaces the N sequential /api/seasons/[id]/games calls the mobile app was making.
// Optional: ?status=upcoming|in_progress|completed|cancelled
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { slug } = await params;
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");

        const org = await Organization.findOne({ slug }).select("_id").lean();
        if (!org) {
            return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
        }

        // Fetch leagues and schedules in parallel
        const [leagues, schedules] = await Promise.all([
            League.find({ organization: org._id }).select("_id name category leagueType season").lean(),
            Schedule.find({ organization: org._id }).select("weeks.name weeks.games.gameRef").lean(),
        ]);

        // A league name can now recur across seasons (e.g. "Chino" every
        // summer), so the mobile app's game filters need the season to
        // actually disambiguate which "Chino" a game belongs to — same
        // reasoning as the admin Leagues/Schedules season columns/filters.
        const seasonIds = [...new Set(leagues.map((l) => l.season).filter(Boolean).map(String))];
        const seasons = seasonIds.length
            ? await Season.find({ _id: { $in: seasonIds } }).select("name").lean()
            : [];
        const seasonNameById = Object.fromEntries(seasons.map((s) => [String(s._id), s.name]));

        // Build gameRef → sectionName map from Schedule weeks (source of truth)
        const gameRefSectionMap = {};
        schedules.forEach((schedule) => {
            (schedule.weeks || []).forEach((week) => {
                const sectionName = week.name || "";
                (week.games || []).forEach((g) => {
                    if (g.gameRef) gameRefSectionMap[String(g.gameRef)] = sectionName;
                });
            });
        });

        if (!leagues.length) {
            return NextResponse.json({ success: true, count: 0, data: [] });
        }

        const leagueIds = leagues.map((l) => l._id);
        const leagueMap = Object.fromEntries(leagues.map((l) => [String(l._id), l]));

        // Single query for all games across all leagues (exclude practice games)
        const filter = { league: { $in: leagueIds }, gameType: { $ne: "practice" } };
        if (status) filter.status = status;

        const games = await Game.find(filter).sort({ date: 1, time: 1 }).lean();

        // Latest team logos and (playoffs leagues only) each team's seed
        // number, resolved by teamId / league — never by name org-wide, since
        // two leagues can each have their own same-named team.
        const withTeams = await enrichGamesWithTeams(games, org._id, {
            isPlayoffs: (game) => leagueMap[String(game.league)]?.leagueType === "playoffs",
        });

        // Enrich with league info and schedule-derived sectionName.
        const data = withTeams.map((game) => {
            const league = leagueMap[String(game.league)];
            const sectionName = gameRefSectionMap[String(game._id)] ?? game.sectionName ?? "";
            return {
                ...game,
                sectionName,
                leagueName: league?.name || "",
                leagueCategory: league?.category || "",
                leagueType: league?.leagueType || "league",
                seasonName: league?.season ? seasonNameById[String(league.season)] || "" : "",
            };
        });

        return NextResponse.json({ success: true, count: data.length, data });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
