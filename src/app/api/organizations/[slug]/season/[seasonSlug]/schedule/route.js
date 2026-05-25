import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Game from "@/models/Game";
import Team from "@/models/Team";

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setUTCDate(d.getUTCDate() - diff);
    return d.toISOString().split("T")[0];
}

export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { slug, seasonSlug } = await params;

        const org = await Organization.findOne({ slug }).select("_id").lean();
        if (!org) return NextResponse.json({ success: false, error: "Org not found" }, { status: 404 });

        const league = await League.findOne({ organization: org._id, slug: seasonSlug }).select("_id").lean();
        if (!league) return NextResponse.json({ success: false, error: "League not found" }, { status: 404 });

        const leagueId = String(league._id);

        // Build week metadata from all game dates (exclude practice games)
        const gameDates = await Game.find({ league: league._id, gameType: { $ne: "practice" } }).select("date").sort({ date: 1 }).lean();

        const weekMap = new Map();
        for (const { date } of gameDates) {
            const ws = getWeekStart(date);
            weekMap.set(ws, (weekMap.get(ws) || 0) + 1);
        }
        const weekMeta = Array.from(weekMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([weekStart, gameCount], idx) => ({ weekNum: idx + 1, weekStart, gameCount }));

        if (weekMeta.length === 0) {
            return NextResponse.json({ success: true, leagueId, weekMeta: [], initialWeekIdx: 0, initialGames: [] });
        }

        // Determine best initial week
        const todayWeekStart = getWeekStart(new Date());
        let initialWeekIdx = weekMeta.findIndex((w) => w.weekStart >= todayWeekStart);
        if (initialWeekIdx === -1) initialWeekIdx = Math.max(0, weekMeta.length - 1);

        // Fetch full game data for the initial week
        const ws = weekMeta[initialWeekIdx].weekStart;
        const weekEnd = new Date(ws);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
        const initialGames = await Game.find({
            league: league._id,
            date: { $gte: new Date(ws), $lt: weekEnd },
            gameType: { $ne: "practice" },
        })
            .sort({ date: 1, time: 1 })
            .lean();

        // Enrich with latest team logos
        const teams = await Team.find({ organization: org._id }).select("name logo").lean();
        const teamLogoMap = {};
        teams.forEach((t) => { teamLogoMap[t.name] = t.logo || ""; });
        initialGames.forEach((game) => {
            if (teamLogoMap[game.teamA?.name] !== undefined)
                game.teamA.logo = teamLogoMap[game.teamA.name] || game.teamA.logo;
            if (teamLogoMap[game.teamB?.name] !== undefined)
                game.teamB.logo = teamLogoMap[game.teamB.name] || game.teamB.logo;
        });

        return NextResponse.json({
            success: true,
            leagueId,
            weekMeta,
            initialWeekIdx,
            initialGames: JSON.parse(JSON.stringify(initialGames)),
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
