import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Team from "@/models/Team";
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

        const league = await League.findOne({ organization: org._id, slug: seasonSlug }).select("_id leagueType").lean();
        if (!league) {
            return NextResponse.json({ players: [] });
        }

        const stats = await computeSeasonStats(league._id, org._id);

        let rows = stats[statType] || [];

        if (teamFilter) {
            // Team filter active: return only that team's per-player rows
            const re = new RegExp(teamFilter, "i");
            rows = rows.filter((r) => re.test(r.teamName));
        }
        // All Players: return per-player-per-team rows so multi-team players appear separately

        // Playoff seed numbers are per-league-membership — attach this
        // league's number to each row by team name, only for playoffs leagues.
        if (league.leagueType === "playoffs" && rows.length > 0) {
            const teamNames = [...new Set(rows.map((r) => r.teamName).filter(Boolean))];
            const teams = await Team.find({ organization: org._id, name: { $in: teamNames } })
                .select("name leagues")
                .lean();
            const seedByTeam = {};
            teams.forEach((t) => {
                const membership = (t.leagues || []).find((m) => String(m.league) === String(league._id));
                seedByTeam[t.name] = membership?.seedNumber ?? null;
            });
            rows = rows.map((r) => ({ ...r, seedNumber: seedByTeam[r.teamName] ?? null }));
        }

        return NextResponse.json({ players: rows });
    } catch (error) {
        console.error("Error computing season stats:", error);
        return NextResponse.json({ error: "Failed to compute stats" }, { status: 500 });
    }
}
