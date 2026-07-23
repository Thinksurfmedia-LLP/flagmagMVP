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

        const league = await League.findOne({ organization: org._id, slug: seasonSlug }).select("_id leagueType").lean();
        if (!league) return NextResponse.json({ success: false, error: "League not found" }, { status: 404 });

        const leagueId = String(league._id);
        const isPlayoffs = league.leagueType === "playoffs";

        // Fetch all non-practice games for the league up front, sorted by date/time
        const allGames = await Game.find({ league: league._id, gameType: { $ne: "practice" } })
            .sort({ date: 1, time: 1 })
            .lean();

        if (allGames.length === 0) {
            return NextResponse.json({ success: true, leagueId, weekMeta: [], initialWeekIdx: 0, weeks: [] });
        }

        // Enrich with latest team logos (and, for playoffs leagues, this
        // league's seed number — a per-membership value, not per-team).
        const teams = await Team.find({ organization: org._id }).select("name logo leagues").lean();
        const teamByName = {};
        teams.forEach((t) => { teamByName[t.name] = t; });
        const seedFor = (team) => {
            if (!isPlayoffs || !team) return null;
            const membership = (team.leagues || []).find((m) => String(m.league) === leagueId);
            return membership?.seedNumber ?? null;
        };
        allGames.forEach((game) => {
            const teamA = teamByName[game.teamA?.name];
            const teamB = teamByName[game.teamB?.name];
            if (teamA) game.teamA.logo = teamA.logo || game.teamA.logo;
            if (teamB) game.teamB.logo = teamB.logo || game.teamB.logo;
            if (isPlayoffs) {
                game.teamA.seedNumber = seedFor(teamA);
                game.teamB.seedNumber = seedFor(teamB);
            }
        });

        // Group games into weeks by week-start
        const weekMap = new Map();
        for (const game of allGames) {
            const ws = getWeekStart(game.date);
            if (!weekMap.has(ws)) weekMap.set(ws, []);
            weekMap.get(ws).push(game);
        }
        const sortedWeekStarts = Array.from(weekMap.keys()).sort((a, b) => a.localeCompare(b));
        const weeks = sortedWeekStarts.map((weekStart, idx) => ({
            weekNum: idx + 1,
            weekStart,
            gameCount: weekMap.get(weekStart).length,
            games: weekMap.get(weekStart),
        }));
        const weekMeta = weeks.map(({ weekNum, weekStart, gameCount }) => ({ weekNum, weekStart, gameCount }));

        // Determine best initial week (first week with an upcoming/today game, else last)
        const todayWeekStart = getWeekStart(new Date());
        let initialWeekIdx = weekMeta.findIndex((w) => w.weekStart >= todayWeekStart);
        if (initialWeekIdx === -1) initialWeekIdx = Math.max(0, weekMeta.length - 1);

        return NextResponse.json({
            success: true,
            leagueId,
            weekMeta,
            initialWeekIdx,
            weeks: JSON.parse(JSON.stringify(weeks)),
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
