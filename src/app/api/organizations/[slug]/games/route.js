import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Game from "@/models/Game";
import Team from "@/models/Team";

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

        // Fetch leagues and teams in parallel
        const [leagues, teams] = await Promise.all([
            League.find({ organization: org._id }).select("_id name category").lean(),
            Team.find({ organization: org._id }).select("name logo").lean(),
        ]);

        if (!leagues.length) {
            return NextResponse.json({ success: true, count: 0, data: [] });
        }

        const leagueIds = leagues.map((l) => l._id);
        const leagueMap = Object.fromEntries(leagues.map((l) => [String(l._id), l]));
        const teamMap = Object.fromEntries(teams.map((t) => [t.name, t]));

        // Single query for all games across all leagues
        const filter = { league: { $in: leagueIds } };
        if (status) filter.status = status;

        const games = await Game.find(filter).sort({ date: 1, time: 1 }).lean();

        // Enrich with league info and latest team logos in one pass
        const data = games.map((game) => {
            const league = leagueMap[String(game.league)];
            const teamALogo = teamMap[game.teamA?.name]?.logo;
            const teamBLogo = teamMap[game.teamB?.name]?.logo;
            return {
                ...game,
                leagueName: league?.name || "",
                leagueCategory: league?.category || "",
                teamA: { ...game.teamA, logo: teamALogo || game.teamA?.logo || "" },
                teamB: { ...game.teamB, logo: teamBLogo || game.teamB?.logo || "" },
            };
        });

        return NextResponse.json({ success: true, count: data.length, data });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
