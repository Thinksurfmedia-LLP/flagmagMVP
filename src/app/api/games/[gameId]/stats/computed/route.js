import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import { computeGameStats } from "@/lib/statsAggregation";

/**
 * GET /api/games/[gameId]/stats/computed?statType=passing&team=TeamName
 *
 * Returns aggregated player stats computed from play-by-play data.
 * statType: passing | receiving | rushing | defensive (default: passing)
 * team: optional team name filter
 */
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { gameId } = await params;
        const { searchParams } = new URL(request.url);
        const statType = searchParams.get("statType") || "passing";
        const teamFilter = searchParams.get("team") || "";

        const result = await computeGameStats(gameId);
        if (!result) {
            return NextResponse.json({ players: [] });
        }

        let rows = result.stats[statType] || [];

        if (teamFilter) {
            const re = new RegExp(teamFilter, "i");
            rows = rows.filter((r) => re.test(r.teamName));
        }

        return NextResponse.json({ players: rows });
    } catch (error) {
        console.error("Error computing game stats:", error);
        return NextResponse.json({ error: "Failed to compute stats" }, { status: 500 });
    }
}
