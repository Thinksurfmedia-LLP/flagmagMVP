import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Venue from "@/models/Location";
import "@/models/County";
import "@/models/State";
import "@/models/Season";
import User from "@/models/User";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";

// GET leagues for an organization
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { slug } = await params;
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");
        const showOnSignup = searchParams.get("showOnSignup");

        const organization = await Organization.findOne({ slug }).lean();
        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        const filter = { organization: organization._id };
        if (type) filter.type = type;
        // Opt-in filter for public signup surfaces — everything else that
        // calls this route (admin games/teams/seasons/stats pickers) still
        // gets the full list regardless of the organizer's signup toggle.
        if (showOnSignup === "true") filter.showOnSignup = true;

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

        const data = leagues.map((league) => ({
            ...league,
            states: [...new Set((league.locations || []).map((name) => stateByVenueName.get(name)).filter(Boolean))],
        }));

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

        const leagueSlug = body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

        const locations = Array.isArray(body.locations)
            ? body.locations.map((s) => String(s).trim()).filter(Boolean)
            : [];

        const league = await League.create({
            organization: organization._id,
            name: body.name.trim(),
            slug: leagueSlug,
            type: body.type || "active",
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
                { success: false, error: "A league with this name already exists for this organization" },
                { status: 400 },
            );
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
