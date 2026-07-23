import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Team from "@/models/Team";
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
        }).select("_id leagueType").lean();

        if (leagues.length === 0) return NextResponse.json({ players: [] });

        const playoffLeagueIds = leagues.filter((l) => l.leagueType === "playoffs").map((l) => String(l._id));

        // Aggregate stats across all leagues, keeping separate rows per player-team combination
        const merged = {};

        // Leagues are independent — compute them concurrently instead of one
        // at a time, since each involves several DB round-trips.
        const perLeagueStats = await Promise.all(
            leagues.map((league) => computeSeasonStats(league._id, org._id))
        );

        for (const stats of perLeagueStats) {
            const rows = stats[statType] || [];
            for (const row of rows) {
                const id = `${row.playerId}|||${row.teamName}`;
                if (!merged[id]) {
                    merged[id] = { ...row };
                } else {
                    // Merge numeric fields across leagues for the same player-team combo
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

        // Attach a playoff seed number per team, only when these selected
        // seasons include a playoffs league — and only when that team's seed
        // is unambiguous (a team seeded differently across two playoffs
        // brackets in the same selection shows no number rather than a wrong one).
        if (playoffLeagueIds.length > 0 && rows.length > 0) {
            const teamNames = [...new Set(rows.map((r) => r.teamName).filter(Boolean))];
            const teams = await Team.find({ organization: org._id, name: { $in: teamNames } })
                .select("name leagues")
                .lean();
            const seedByTeam = {};
            teams.forEach((t) => {
                const seeds = [...new Set(
                    (t.leagues || [])
                        .filter((m) => playoffLeagueIds.includes(String(m.league)) && m.seedNumber !== null && m.seedNumber !== undefined)
                        .map((m) => m.seedNumber)
                )];
                seedByTeam[t.name] = seeds.length === 1 ? seeds[0] : null;
            });
            rows.forEach((r) => { r.seedNumber = seedByTeam[r.teamName] ?? null; });
        }
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
