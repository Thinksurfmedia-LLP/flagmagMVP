import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Season from "@/models/Season";
import Game from "@/models/Game";
import Team from "@/models/Team";
import Schedule from "@/models/Schedule";

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

        // Fetch leagues, teams, and schedules in parallel
        const [leagues, teams, schedules] = await Promise.all([
            League.find({ organization: org._id }).select("_id name category leagueType season").lean(),
            Team.find({ organization: org._id }).select("name logo leagues").lean(),
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
        const teamMap = Object.fromEntries(teams.map((t) => [t.name, t]));

        // Single query for all games across all leagues (exclude practice games)
        const filter = { league: { $in: leagueIds }, gameType: { $ne: "practice" } };
        if (status) filter.status = status;

        const games = await Game.find(filter).sort({ date: 1, time: 1 }).lean();

        // Enrich with league info, latest team logos, schedule-derived sectionName,
        // and (playoffs leagues only) each team's seed number for this league.
        const seedFor = (team, leagueId, isPlayoffs) => {
            if (!isPlayoffs || !team) return null;
            const membership = (team.leagues || []).find((m) => String(m.league) === String(leagueId));
            return membership?.seedNumber ?? null;
        };

        const data = games.map((game) => {
            const league = leagueMap[String(game.league)];
            const isPlayoffs = league?.leagueType === "playoffs";
            const teamAData = teamMap[game.teamA?.name];
            const teamBData = teamMap[game.teamB?.name];
            const sectionName = gameRefSectionMap[String(game._id)] ?? game.sectionName ?? "";
            return {
                ...game,
                sectionName,
                leagueName: league?.name || "",
                leagueCategory: league?.category || "",
                leagueType: league?.leagueType || "league",
                seasonName: league?.season ? seasonNameById[String(league.season)] || "" : "",
                teamA: {
                    ...game.teamA,
                    logo: teamAData?.logo || game.teamA?.logo || "",
                    seedNumber: seedFor(teamAData, game.league, isPlayoffs),
                },
                teamB: {
                    ...game.teamB,
                    logo: teamBData?.logo || game.teamB?.logo || "",
                    seedNumber: seedFor(teamBData, game.league, isPlayoffs),
                },
            };
        });

        return NextResponse.json({ success: true, count: data.length, data });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
