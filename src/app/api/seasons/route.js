import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Season from "@/models/Season";
import Organization from "@/models/Organization";
import User from "@/models/User";
import { requireAnyPermission } from "@/lib/apiAuth";

// GET all seasons (admin sees all; organizer sees own org's)
export async function GET(request) {
    try {
        const auth = await requireAnyPermission([
            "manage_seasons", "season_view", "season_create", "season_update", "season_delete",
        ]);
        if (!auth.authorized) return auth.response;

        await dbConnect();

        const { searchParams } = new URL(request.url);
        const orgId = searchParams.get("organization");
        const search = searchParams.get("search");

        const filter = {};

        if (auth.user.role === "admin") {
            if (orgId) filter.organization = orgId;
        } else {
            const currentUser = await User.findById(auth.user.id).select("organization").lean();
            if (!currentUser?.organization) {
                return NextResponse.json({ success: true, data: [] });
            }
            filter.organization = currentUser.organization;
        }

        if (search) {
            filter.name = { $regex: search, $options: "i" };
        }

        const seasons = await Season.find(filter)
            .populate("organization", "name slug")
            .sort({ createdAt: -1 })
            .lean();

        return NextResponse.json({ success: true, data: seasons });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST create a season
export async function POST(request) {
    try {
        const auth = await requireAnyPermission(["manage_seasons", "season_create"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const body = await request.json();

        if (!body.name || !body.name.trim()) {
            return NextResponse.json({ success: false, error: "Season name is required" }, { status: 400 });
        }

        if (!body.organization) {
            return NextResponse.json({ success: false, error: "Organization is required" }, { status: 400 });
        }

        const organization = await Organization.findById(body.organization);
        if (!organization) {
            return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
        }

        // Organizers can only create seasons for their own org
        if (auth.user.role !== "admin") {
            const currentUser = await User.findById(auth.user.id).select("organization").lean();
            if (!currentUser?.organization || String(currentUser.organization) !== String(organization._id)) {
                return NextResponse.json(
                    { success: false, error: "You can only create seasons for your assigned organization" },
                    { status: 403 },
                );
            }
        }

        const slug = body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

        // If this season is set as default, unset any existing default for this org
        if (body.isDefault) {
            await Season.updateMany(
                { organization: organization._id, isDefault: true },
                { $set: { isDefault: false } },
            );
        }

        const season = await Season.create({
            organization: organization._id,
            name: body.name.trim(),
            slug,
            isDefault: body.isDefault || false,
        });

        return NextResponse.json({ success: true, data: season }, { status: 201 });
    } catch (error) {
        if (error.code === 11000) {
            return NextResponse.json(
                { success: false, error: "A season with this name already exists for this organization" },
                { status: 400 },
            );
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
