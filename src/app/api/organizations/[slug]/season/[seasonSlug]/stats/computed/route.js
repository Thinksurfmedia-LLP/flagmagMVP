import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import { computeSeasonStats } from "@/lib/statsAggregation";

/**
 * GET /api/organizations/[slug]/season/[seasonSlug]/stats/computed?statType=passing&team=TeamName
 *
 * Returns aggregated player stats across all games in a season, computed from play-by-play data.
 * statType: passing | receiving | rushing | defensive (default: passing)
 * team: optional team name filter
 */
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { slug, seasonSlug } = await params;
        const { searchParams } = new URL(request.url);
        const statType = searchParams.get("statType") || "passing";
        const teamFilter = searchParams.get("team") || "";

        const org = await Organization.findOne({ slug }).select("_id").lean();
        if (!org) {
            return NextResponse.json({ players: [] });
        }

        const league = await League.findOne({ organization: org._id, slug: seasonSlug }).select("_id").lean();
        if (!league) {
            return NextResponse.json({ players: [] });
        }

        const stats = await computeSeasonStats(league._id, org._id);

        let rows = stats[statType] || [];

        if (teamFilter) {
            const re = new RegExp(teamFilter, "i");
            rows = rows.filter((r) => re.test(r.teamName));
        }

        return NextResponse.json({ players: rows });
    } catch (error) {
        console.error("Error computing season stats:", error);
        return NextResponse.json({ error: "Failed to compute stats" }, { status: 500 });
    }
}
