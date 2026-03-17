import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import Season from "@/models/Season";
import User from "@/models/User";
import { requireAnyPermission } from "@/lib/apiAuth";
import { formatOrganizationLocationEntry } from "@/lib/organizationLocations";
import Venue from "@/models/Location";

function normalizeText(value = "") {
    return String(value).trim().toLowerCase();
}

// GET seasons for an organization
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { slug } = await params;
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");

        const organization = await Organization.findOne({ slug }).lean();
        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        const filter = { organization: organization._id };
        if (type) filter.type = type;

        const seasons = await Season.find(filter).sort({ startDate: -1 }).lean();

        return NextResponse.json(
            { success: true, count: seasons.length, data: seasons },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// CREATE season for an organization (admin/organizer only)
export async function POST(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_seasons", "season_create"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { slug } = await params;

        const organization = await Organization.findOne({ slug });
        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        if (auth.user.role === "organizer") {
            const currentUser = await User.findById(auth.user.id).select("organization").lean();
            if (!currentUser?.organization || String(currentUser.organization) !== String(organization._id)) {
                return NextResponse.json(
                    { success: false, error: "You can only create seasons for your assigned organization" },
                    { status: 403 }
                );
            }
        }

        const body = await request.json();
        body.organization = organization._id;

        const locations = Array.isArray(body.locations)
            ? body.locations.map((entry) => String(entry).trim()).filter(Boolean)
            : [];

        if (auth.user.role === "organizer") {
            const allowedCategories = (organization.categories || []).map((entry) => String(entry).trim()).filter(Boolean);
            const allowedCategorySet = new Set(allowedCategories.map(normalizeText));

            if (body.category && !allowedCategorySet.has(normalizeText(body.category))) {
                return NextResponse.json(
                    { success: false, error: "Category must be one of your organization's registered categories" },
                    { status: 400 }
                );
            }

            const orgLocationKeys = new Set(
                (organization.locations || [])
                    .filter((loc) => loc.countyName && loc.stateAbbr)
                    .map((loc) => `${normalizeText(loc.countyName)}|${normalizeText(loc.stateAbbr)}`)
            );

            const venues = await Venue.find({ name: { $in: locations } })
                .populate({ path: "county", populate: { path: "state" } })
                .lean();

            const hasInvalidLocation = locations.some((venueName) => {
                const venue = venues.find((v) => normalizeText(v.name) === normalizeText(venueName));
                if (!venue || !venue.county) return true;
                const key = `${normalizeText(venue.county.name)}|${normalizeText(venue.county.state?.abbreviation || "")}`;
                return !orgLocationKeys.has(key);
            });
            if (hasInvalidLocation) {
                return NextResponse.json(
                    { success: false, error: "Location must be selected from your organization's configured locations" },
                    { status: 400 }
                );
            }
        }

        body.locations = locations;
        body.location = locations[0] || body.location || "";
        delete body.time;

        // Auto-generate slug from name if not provided
        if (!body.slug && body.name) {
            body.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        }

        const season = await Season.create(body);

        return NextResponse.json(
            { success: true, data: season },
            { status: 201 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
