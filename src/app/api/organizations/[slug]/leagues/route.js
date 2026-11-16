import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Venue from "@/models/Location";
import County from "@/models/County";
import State from "@/models/State";
import Season from "@/models/Season";
import User from "@/models/User";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";
import { generateUniqueLeagueSlug } from "@/lib/leagueSlug";
import { computeLeagueType } from "@/lib/leagueSeasonSync";
import { createFingerprintCache } from "@/lib/fingerprintCache";
import { fingerprintOf } from "@/lib/dataFingerprint";
import { normalizeSeasonParam } from "@/lib/leagueListQuery";

// The full list is ~900 leagues (~630KB) once legacy seasons are imported;
// building it took ~6 sequential Atlas round trips plus the 570KB league
// pull on every call. The finished list is cached per org + query and
// reused while nothing it's built from has changed (count + latest updatedAt
// of the org's leagues and seasons, and of venues/counties/states for the
// `states` field). A change makes the next caller wait for the rebuild
// (serveStaleOnChange: false) — admin pickers use this route right after
// creating a league, so it must never answer with the pre-change list.
const leagueListCache = createFingerprintCache({
    // Safety net for edits the fingerprint can't see (e.g. a raw DB write).
    maxAgeMs: 5 * 60 * 1000,
    maxEntries: 100,
    serveStaleOnChange: false,
    onBackgroundError: (error, key) => console.error(`[org leagues] background refresh failed for ${key}:`, error),
});

async function computeLeagueListFingerprint(orgId) {
    const parts = await Promise.all([
        fingerprintOf(League, { organization: orgId }),
        fingerprintOf(Season, { organization: orgId }),
        fingerprintOf(Venue, {}),
        fingerprintOf(County, {}),
        fingerprintOf(State, {}),
    ]);
    return parts.map((p) => p.part).join("|");
}

/** The route's `data` array for one org + query (see GET). */
async function buildLeagueList(orgId, { type, showOnSignup, leagueSlug, season }) {
    const filter = { organization: orgId };
    if (type) filter.type = type;
    // Opt-in filter for public signup surfaces — everything else that
    // calls this route (admin games/teams/seasons/stats pickers) still
    // gets the full list regardless of the organizer's signup toggle.
    if (showOnSignup === "true") filter.showOnSignup = true;
    // Single-league lookup for public league pages — the full list is
    // ~900 leagues (~600KB) once legacy seasons are imported.
    if (leagueSlug) filter.slug = String(leagueSlug);
    // ?season=default — only the default season's leagues (xFlag's results
    // ticker, rendered on every page). No default season → no filter.
    // ?season=<seasonId> — only that season's leagues. Anything else is
    // ignored (every league), as before this param took ids.
    if (season === "default") {
        const defaultSeason = await Season.findOne({ organization: orgId, isDefault: true }).select("_id").lean();
        if (defaultSeason) filter.season = defaultSeason._id;
    } else if (season) {
        filter.season = new mongoose.Types.ObjectId(season);
    }

    const leagues = await League.find(filter)
        .populate("season", "name isDefault")
        .sort({ startDate: -1 })
        .lean();

    // Resolve each league's venue names to state abbreviations so public
    // callers (the signup checkout's state-scoped league filter) can
    // narrow the list without needing admin access to /api/locations.
    const venueNames = [...new Set(leagues.flatMap((l) => l.locations || []))];
    const stateByVenueName = new Map();
    if (venueNames.length) {
        const venues = await Venue.find({ name: { $in: venueNames } })
            .populate({ path: "county", populate: { path: "state", select: "abbreviation" } })
            .select("name county")
            .lean();
        for (const venue of venues) {
            const abbr = venue.county?.state?.abbreviation;
            if (abbr) stateByVenueName.set(venue.name, abbr);
        }
    }

    return leagues.map((league) => ({
        ...league,
        states: [...new Set((league.locations || []).map((name) => stateByVenueName.get(name)).filter(Boolean))],
    }));
}

// GET leagues for an organization
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { slug } = await params;
        const { searchParams } = new URL(request.url);
        const query = {
            type: searchParams.get("type"),
            showOnSignup: searchParams.get("showOnSignup"),
            leagueSlug: searchParams.get("slug"),
            season: normalizeSeasonParam(searchParams.get("season")),
        };

        const organization = await Organization.findOne({ slug }).select("_id").lean();
        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        // Only the params buildLeagueList reads, normalized the way it reads them.
        const cacheKey = JSON.stringify([
            String(organization._id),
            query.type || "",
            query.showOnSignup === "true",
            query.leagueSlug || "",
            query.season || "",
        ]);
        const data = await leagueListCache.get(cacheKey, {
            fingerprint: () => computeLeagueListFingerprint(organization._id),
            compute: () => buildLeagueList(organization._id, query),
        });

        return NextResponse.json(
            { success: true, count: data.length, data },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST create a league under this organization
export async function POST(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_leagues", "league_create"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { slug } = await params;
        const body = await request.json();

        const organization = await Organization.findOne({ slug }).lean();
        if (!organization) {
            return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
        }

        // Organizers can only create leagues for their own org
        if (hasRole(auth.user, "organizer")) {
            const currentUser = await User.findById(auth.user.id).select("organization roleOrganizations").lean();
            const directOrg = currentUser?.organization ? String(currentUser.organization) : null;
            const roleOrgValues = Object.values(currentUser?.roleOrganizations || {})
                .flatMap(v => Array.isArray(v) ? v : [v])
                .map(String);
            const userOrgIds = [...new Set([directOrg, ...roleOrgValues].filter(Boolean))];
            if (!userOrgIds.includes(String(organization._id))) {
                return NextResponse.json(
                    { success: false, error: "You can only create leagues for your assigned organization" },
                    { status: 403 },
                );
            }
        }

        if (!body.name || !body.name.trim()) {
            return NextResponse.json({ success: false, error: "League name is required" }, { status: 400 });
        }

        const leagueSlug = await generateUniqueLeagueSlug({
            organizationId: organization._id,
            seasonId: body.season || null,
            name: body.name,
        });

        const locations = Array.isArray(body.locations)
            ? body.locations.map((s) => String(s).trim()).filter(Boolean)
            : [];

        // Auto-derived from the season's default status unless the caller
        // explicitly pinned a status — see src/lib/leagueSeasonSync.js.
        const typeOverridden = Boolean(body.typeOverridden);
        const type = typeOverridden
            ? (["active", "past"].includes(body.type) ? body.type : "active")
            : await computeLeagueType(body.season || null);

        const league = await League.create({
            organization: organization._id,
            name: body.name.trim(),
            slug: leagueSlug,
            type,
            typeOverridden,
            category: body.category || "",
            locations,
            location: locations[0] || "",
            startDate: body.startDate || undefined,
            time: body.time || "",
        });

        return NextResponse.json({ success: true, data: league }, { status: 201 });
    } catch (error) {
        if (error.code === 11000) {
            return NextResponse.json(
                { success: false, error: "A league with this name already exists for this organization and season" },
                { status: 400 },
            );
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
