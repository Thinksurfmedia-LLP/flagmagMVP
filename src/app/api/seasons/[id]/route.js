import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Season from "@/models/Season";
import User from "@/models/User";
import Organization from "@/models/Organization";
import { requireAnyPermission } from "@/lib/apiAuth";
import { formatOrganizationLocationEntry } from "@/lib/organizationLocations";
import Venue from "@/models/Location";

function normalizeText(value = "") {
    return String(value).trim().toLowerCase();
}

// GET single season
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { id } = await params;
        const season = await Season.findById(id).populate("organization", "name slug logo").lean();

        if (!season) {
            return NextResponse.json(
                { success: false, error: "Season not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { success: true, data: season },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// UPDATE season (admin/organizer only)
export async function PUT(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_seasons", "season_update"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const body = await request.json();

        const existingSeason = await Season.findById(id).select("organization").lean();
        if (!existingSeason) {
            return NextResponse.json(
                { success: false, error: "Season not found" },
                { status: 404 }
            );
        }

        if (auth.user.role === "organizer") {
            const currentUser = await User.findById(auth.user.id).select("organization").lean();
            if (!currentUser?.organization || String(currentUser.organization) !== String(existingSeason.organization)) {
                return NextResponse.json(
                    { success: false, error: "You can only update seasons for your assigned organization" },
                    { status: 403 }
                );
            }

            const organization = await Organization.findById(existingSeason.organization).select("categories locations").lean();
            if (!organization) {
                return NextResponse.json(
                    { success: false, error: "Organization not found" },
                    { status: 404 }
                );
            }

            if (body.category !== undefined) {
                const allowedCategorySet = new Set(
                    (organization.categories || []).map((entry) => normalizeText(entry)).filter(Boolean)
                );
                if (body.category && !allowedCategorySet.has(normalizeText(body.category))) {
                    return NextResponse.json(
                        { success: false, error: "Category must be one of your organization's registered categories" },
                        { status: 400 }
                    );
                }
            }

            if (body.locations !== undefined) {
                const locations = Array.isArray(body.locations)
                    ? body.locations.map((entry) => String(entry).trim()).filter(Boolean)
                    : [];
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

                body.locations = locations;
                body.location = locations[0] || "";
            }
        }

        delete body.time;

        const season = await Season.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        if (!season) {
            return NextResponse.json(
                { success: false, error: "Season not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: season }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE season (admin/organizer only)
export async function DELETE(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_seasons", "season_delete"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const season = await Season.findById(id).select("organization");

        if (!season) {
            return NextResponse.json(
                { success: false, error: "Season not found" },
                { status: 404 }
            );
        }

        if (auth.user.role === "organizer") {
            const currentUser = await User.findById(auth.user.id).select("organization").lean();
            if (!currentUser?.organization || String(currentUser.organization) !== String(season.organization)) {
                return NextResponse.json(
                    { success: false, error: "You can only delete seasons for your assigned organization" },
                    { status: 403 }
                );
            }
        }

        await Season.deleteOne({ _id: id });

        return NextResponse.json({ success: true, message: "Season deleted" }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
