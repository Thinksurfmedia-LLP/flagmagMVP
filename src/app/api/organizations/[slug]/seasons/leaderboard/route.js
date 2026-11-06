import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import { computeSeasonStats, isNoStatsTeamName } from "@/lib/statsAggregation";
import { passingDerived } from "@/lib/importedStats";

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
        }).select("_id leagueType name").lean();

        if (leagues.length === 0) return NextResponse.json({ players: [] });

        // Season leaderboard is regular-season only — playoffs (including
        // combined brackets like "CASH COUNTIES XXIII") don't count toward it.
        const regularSeasonLeagues = leagues.filter((l) => l.leagueType !== "playoffs");
        if (regularSeasonLeagues.length === 0) return NextResponse.json({ players: [] });

        // Aggregate stats across all leagues, keeping separate rows per player-team combination
        const merged = {};

        // Leagues are independent — compute them concurrently instead of one
        // at a time, since each involves several DB round-trips.
        const perLeagueStats = await Promise.all(
            regularSeasonLeagues.map((league) => computeSeasonStats(league._id, org._id))
        );

        // League name(s) each player-team row's stats came from — usually one,
        // but a team entered in two leagues of the season merges into one row.
        const leagueNamesById = {};

        perLeagueStats.forEach((stats, leagueIdx) => {
            const leagueName = regularSeasonLeagues[leagueIdx].name || "";
            const rows = stats[statType] || [];
            for (const row of rows) {
                // Ad-hoc "<Team> STATS" scrimmage rosters (see isNoStatsTeamName)
                // still show on the per-league player-stats page — only the
                // cross-league season leaderboard excludes them.
                if (isNoStatsTeamName(row.teamName)) continue;
                const id = `${row.playerId}|||${row.teamName}`;
                if (!leagueNamesById[id]) leagueNamesById[id] = new Set();
                if (leagueName) leagueNamesById[id].add(leagueName);
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
                    merged[id].legacy = Boolean(merged[id].legacy && row.legacy);
                }
            }
        });

        // Recalculate derived fields for passing
        const rows = Object.entries(merged).map(([id, row]) => ({
            ...row,
            leagueName: [...leagueNamesById[id]].join(", "),
        }));

        // No seed number here — this leaderboard is regular-season only, and
        // seeds are a playoffs concept; showing one next to a team's name on
        // a regular-season table implies playoff stats fed the row, which
        // they don't. (Per-league pages that do include playoffs still show it.)
        if (statType === "passing") {
            // Old-site (imported) rows keep the old site's % and rating formulas.
            for (const p of rows) Object.assign(p, passingDerived(p, p.legacy === true));
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
