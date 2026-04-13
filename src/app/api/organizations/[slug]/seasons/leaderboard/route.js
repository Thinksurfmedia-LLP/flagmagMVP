import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import { computeSeasonStats } from "@/lib/statsAggregation";

/**
 * GET /api/organizations/[slug]/seasons/leaderboard?seasons=id1,id2&statType=passing
 *
 * Aggregates player stats across ALL leagues belonging to the given season IDs.
 */
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { slug } = await params;
        const { searchParams } = new URL(request.url);
        const seasonsParam = searchParams.get("seasons") || "";
        const statType = searchParams.get("statType") || "passing";

        const org = await Organization.findOne({ slug }).select("_id").lean();
        if (!org) return NextResponse.json({ players: [] });

        const seasonIds = seasonsParam.split(",").map((s) => s.trim()).filter(Boolean);
        if (seasonIds.length === 0) return NextResponse.json({ players: [] });

        // Find all leagues in these seasons for this org
        const leagues = await League.find({
            organization: org._id,
            season: { $in: seasonIds },
        }).select("_id").lean();

        if (leagues.length === 0) return NextResponse.json({ players: [] });

        // Aggregate stats across all leagues and merge by playerId
        const merged = {};

        for (const league of leagues) {
            const stats = await computeSeasonStats(league._id, org._id);
            const rows = stats[statType] || [];
            for (const row of rows) {
                const id = row.playerId;
                if (!merged[id]) {
                    merged[id] = { ...row };
                } else {
                    // Merge numeric fields
                    for (const key of Object.keys(row)) {
                        if (key === "playerId" || key === "playerName" || key === "playerPhoto" || key === "teamName") continue;
                        if (typeof row[key] === "number") {
                            merged[id][key] = (merged[id][key] || 0) + row[key];
                        }
                    }
                }
            }
        }

        // Recalculate derived fields for passing
        const rows = Object.values(merged);
        if (statType === "passing") {
            for (const p of rows) {
                const atts = p.atts || 0;
                const comp = p.comp || 0;
                const yards = p.yards || 0;
                const tds = p.tds || 0;
                const ints = p.ints || 0;
                p.pct = atts > 0 ? parseFloat(((comp / atts) * 100).toFixed(1)) : 0;
                p.ypc = comp > 0 ? parseFloat((yards / comp).toFixed(1)) : 0;
                if (atts > 0) {
                    let a = Math.max(0, Math.min(((comp / atts) - 0.3) * 5, 2.375));
                    let b = Math.max(0, Math.min(((yards / atts) - 3) * 0.25, 2.375));
                    let c = Math.max(0, Math.min((tds / atts) * 20, 2.375));
                    let d = Math.max(0, Math.min(2.375 - ((ints / atts) * 25), 2.375));
                    p.rate = parseFloat((((a + b + c + d) / 6) * 100).toFixed(1));
                } else {
                    p.rate = 0;
                }
            }
        } else if (statType === "receiving") {
            for (const r of rows) {
                r.ypr = r.receptions > 0 ? parseFloat((r.yards / r.receptions).toFixed(1)) : 0;
            }
        } else if (statType === "rushing") {
            for (const r of rows) {
                r.ypc = r.atts > 0 ? parseFloat((r.yards / r.atts).toFixed(1)) : 0;
                const gp = r.gamesPlayed || 1;
                r.rushAvgPerGame = parseFloat((r.yards / gp).toFixed(1));
            }
        } else if (statType === "defensive") {
            for (const d of rows) {
                const gp = d.gamesPlayed || 1;
                d.flagPullsPerGame = parseFloat(((d.flagPulls || 0) / gp).toFixed(1));
                d.defImpact = (d.dint || 0) + (d.dsacks || 0);
            }
        }

        return NextResponse.json({ players: rows });
    } catch (error) {
        console.error("Season leaderboard error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
