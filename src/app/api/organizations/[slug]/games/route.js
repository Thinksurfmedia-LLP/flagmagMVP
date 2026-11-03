import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Season from "@/models/Season";
import Game from "@/models/Game";
import Schedule from "@/models/Schedule";
import Team from "@/models/Team";
import { enrichGamesWithTeams } from "@/lib/gameTeams";
import { createFingerprintCache } from "@/lib/fingerprintCache";
import { fingerprintOf } from "@/lib/dataFingerprint";
import { parseGameListQuery, applyGameListQuery, gameListFindOptions } from "@/lib/gameListQuery";

// Every game an org has ever had is ~3.5k documents for XFlagFootball, and
// pulling them over the Atlas link takes ~25s — so the full, enriched list
// is cached per org and reused until any of the collections it's built from
// changes (stale-while-revalidate; see fingerprintCache.js).
const orgGamesCache = createFingerprintCache({
    // Safety net for edits the fingerprint can't see (e.g. a raw DB write).
    maxAgeMs: 5 * 60 * 1000,
    maxEntries: 50,
    onBackgroundError: (error, key) => console.error(`[org games] background refresh failed for ${key}:`, error),
});

// Count + latest updatedAt of everything the response is built from:
// leagues, their games, schedules (section names), teams (logos/seeds), seasons.
async function computeOrgGamesFingerprint(orgId) {
    const leagues = await fingerprintOf(League, { organization: orgId }, { ids: { $push: "$_id" } });
    const leagueIds = leagues.row?.ids || [];
    const parts = await Promise.all([
        fingerprintOf(Game, { league: { $in: leagueIds }, gameType: { $ne: "practice" } }),
        fingerprintOf(Schedule, { organization: orgId }),
        fingerprintOf(Team, { organization: orgId }),
        fingerprintOf(Season, { organization: orgId }),
    ]);
    return [leagues.part, ...parts.map((p) => p.part)].join("|");
}

/**
 * Every non-practice game for the org (optionally only `onlyLeagueIds`),
 * ascending by date/time, enriched with league, season, section and team info.
 * `find` (from gameListFindOptions) narrows/orders/limits the game query.
 */
async function buildOrgGames(orgId, onlyLeagueIds = null, find = { filter: {}, sort: { date: 1, time: 1 }, limit: null }) {
    const leagueFilter = { organization: orgId };
    if (onlyLeagueIds) leagueFilter._id = { $in: onlyLeagueIds };

    // Fetch leagues and schedules in parallel
    const [leagues, schedules] = await Promise.all([
        League.find(leagueFilter).select("_id name category leagueType season").lean(),
        Schedule.find(onlyLeagueIds ? { organization: orgId, leagueId: { $in: onlyLeagueIds } } : { organization: orgId })
            .select("weeks.name weeks.games.gameRef")
            .lean(),
    ]);
    if (!leagues.length) return [];

    // A league name can now recur across seasons (e.g. "Chino" every
    // summer), so the mobile app's game filters need the season to
    // actually disambiguate which "Chino" a game belongs to — same
    // reasoning as the admin Leagues/Schedules season columns/filters.
    const seasonIds = [...new Set(leagues.map((l) => l.season).filter(Boolean).map(String))];
    const seasons = seasonIds.length
        ? await Season.find({ _id: { $in: seasonIds } }).select("name").lean()
        : [];
    const seasonNameById = Object.fromEntries(seasons.map((s) => [String(s._id), s.name]));

    // Build gameRef → sectionName map from Schedule weeks (source of truth)
    const gameRefSectionMap = {};
    schedules.forEach((schedule) => {
        (schedule.weeks || []).forEach((week) => {
            const sectionName = week.name || "";
            (week.games || []).forEach((g) => {
                if (g.gameRef) gameRefSectionMap[String(g.gameRef)] = sectionName;
            });
        });
    });

    const leagueMap = Object.fromEntries(leagues.map((l) => [String(l._id), l]));

    // Single query for all games across all leagues (exclude practice games)
    const gameQuery = Game.find({ ...find.filter, league: { $in: leagues.map((l) => l._id) }, gameType: { $ne: "practice" } })
        .sort(find.sort);
    if (find.limit) gameQuery.limit(find.limit);
    const games = await gameQuery.lean();

    // Latest team logos and (playoffs leagues only) each team's seed
    // number, resolved by teamId / league — never by name org-wide, since
    // two leagues can each have their own same-named team.
    const withTeams = await enrichGamesWithTeams(games, orgId, {
        isPlayoffs: (game) => leagueMap[String(game.league)]?.leagueType === "playoffs",
    });

    // Enrich with league info and schedule-derived sectionName.
    return withTeams.map((game) => {
        const league = leagueMap[String(game.league)];
        const sectionName = gameRefSectionMap[String(game._id)] ?? game.sectionName ?? "";
        return {
            ...game,
            sectionName,
            leagueName: league?.name || "",
            leagueCategory: league?.category || "",
            leagueType: league?.leagueType || "league",
            seasonName: league?.season ? seasonNameById[String(league.season)] || "" : "",
        };
    });
}

// League ids for ?season=<id>|default, or null for "no season filter" (no
// param, or no default season set — callers then get every league).
async function resolveSeasonLeagueIds(orgId, season) {
    if (!season) return null;
    let seasonId = null;
    if (season === "default") {
        seasonId = (await Season.findOne({ organization: orgId, isDefault: true }).select("_id").lean())?._id ?? null;
        if (!seasonId) return null;
    } else if (mongoose.isValidObjectId(season)) {
        seasonId = season;
    } else {
        return [];
    }
    return League.distinct("_id", { organization: orgId, season: seasonId });
}

// GET /api/organizations/[slug]/games
// Returns all games across every league for this org in a single round-trip.
// Replaces the N sequential /api/seasons/[id]/games calls the mobile app was making.
// Optional narrowing (see gameListQuery.js):
//   ?status=upcoming|in_progress|completed|cancelled
//   ?season=<seasonId>|default   only that season's leagues
//   ?order=desc                  newest first (default: oldest first)
//   ?limit=N                     at most N games, applied after the above
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { slug } = await params;
        const query = parseGameListQuery(new URL(request.url).searchParams);

        const org = await Organization.findOne({ slug }).select("_id").lean();
        if (!org) {
            return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
        }

        const cacheKey = String(org._id);
        const seasonLeagueIds = await resolveSeasonLeagueIds(org._id, query.season);
        if (seasonLeagueIds && seasonLeagueIds.length === 0) {
            return NextResponse.json({ success: true, count: 0, data: [] });
        }

        // A season slice (e.g. xFlag's results ticker on every page) is
        // queried straight from the DB with status/order/limit applied there.
        // It must never go through the full-org cache: since the legacy
        // imports that's ~21k games (~13MB), and every rebuild (server start,
        // any data change, every maxAgeMs) saturates the Atlas link for
        // minutes, timing out every other request meanwhile.
        if (seasonLeagueIds) {
            const data = await buildOrgGames(org._id, seasonLeagueIds, gameListFindOptions(query));
            return NextResponse.json({ success: true, count: data.length, data });
        }

        const games = await orgGamesCache.get(cacheKey, {
            fingerprint: () => computeOrgGamesFingerprint(org._id),
            compute: () => buildOrgGames(org._id),
        });
        const data = applyGameListQuery(games, query, null);
        return NextResponse.json({ success: true, count: data.length, data });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
