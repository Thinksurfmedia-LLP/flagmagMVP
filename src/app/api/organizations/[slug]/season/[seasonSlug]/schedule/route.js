import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Game from "@/models/Game";
import Team from "@/models/Team";
import Schedule from "@/models/Schedule";

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

        // Week grouping (name, boundaries, game membership) comes from the
        // admin-curated Schedule doc — the same source of truth the public
        // organizations/[slug]/season/[seasonSlug] page uses. Do NOT re-derive
        // week numbers from raw game dates: a single admin-defined week can
        // legitimately span more than one calendar date (doubleheaders moved,
        // makeup games appended to an existing week, etc.), and bucketing by
        // date alone silently splits one real week into two, producing a
        // phantom extra week that disagrees with the admin schedule everywhere
        // else in the product.
        const leagueSchedule = await Schedule.findOne({ leagueId: league._id })
            .select("weeks.name weeks.games.gameRef")
            .lean();

        const scheduleWeeks = leagueSchedule?.weeks || [];
        let weekSections = scheduleWeeks
            .map((w, idx) => {
                const gameRefs = (w.games || []).map((g) => g.gameRef).filter(Boolean).map(String);
                return { weekNum: idx + 1, weekName: w.name || `Week ${idx + 1}`, gameRefs };
            })
            .filter((s) => s.gameRefs.length > 0);

        // Fallback: no Schedule doc (or none of its weeks reference real games)
        // — show every non-practice game as a single, unlabeled section rather
        // than inventing week boundaries from dates.
        if (weekSections.length === 0) {
            const allGames = await Game.find({ league: league._id, gameType: { $ne: "practice" } })
                .select("_id")
                .sort({ date: 1, time: 1 })
                .lean();
            if (allGames.length > 0) {
                weekSections = [{ weekNum: 1, weekName: "", gameRefs: allGames.map((g) => String(g._id)) }];
            }
        }

        if (weekSections.length === 0) {
            return NextResponse.json({ success: true, leagueId, weekMeta: [], initialWeekIdx: 0, weeks: [] });
        }

        // Fetch every referenced game once, then re-attach to its section —
        // avoids one query per week.
        const allGameIds = weekSections.flatMap((s) => s.gameRefs);
        const games = await Game.find({ _id: { $in: allGameIds } }).lean();
        const gameById = new Map(games.map((g) => [String(g._id), g]));

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
        games.forEach((game) => {
            const teamA = teamByName[game.teamA?.name];
            const teamB = teamByName[game.teamB?.name];
            if (teamA) game.teamA.logo = teamA.logo || game.teamA.logo;
            if (teamB) game.teamB.logo = teamB.logo || game.teamB.logo;
            if (isPlayoffs) {
                game.teamA.seedNumber = seedFor(teamA);
                game.teamB.seedNumber = seedFor(teamB);
            }
        });

        const weeks = weekSections.map(({ weekNum, weekName, gameRefs }) => {
            const weekGames = gameRefs.map((id) => gameById.get(id)).filter(Boolean)
                .sort((a, b) => new Date(a.date) - new Date(b.date) || String(a.time).localeCompare(String(b.time)));
            return {
                weekNum,
                weekStart: weekName || `week-${weekNum}`,
                gameCount: weekGames.length,
                games: weekGames,
            };
        });
        const weekMeta = weeks.map(({ weekNum, weekStart, gameCount }) => ({ weekNum, weekStart, gameCount }));

        // Determine best initial week (first week with an upcoming/today game, else last)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let initialWeekIdx = weeks.findIndex((w) => w.games.some((g) => new Date(g.date) >= today));
        if (initialWeekIdx === -1) initialWeekIdx = Math.max(0, weeks.length - 1);

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
