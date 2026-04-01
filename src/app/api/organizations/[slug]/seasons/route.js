import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import Season from "@/models/Season";
import User from "@/models/User";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";

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

        const seasons = await Season.find(filter).sort({ createdAt: -1 }).lean();

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

        if (hasRole(auth.user, "organizer")) {
            const currentUser = await User.findById(auth.user.id).select("organization roleOrganizations").lean();
            const directOrg = currentUser?.organization ? String(currentUser.organization) : null;
            const roleOrgValues = Object.values(currentUser?.roleOrganizations || {})
                .flatMap(v => Array.isArray(v) ? v : [v])
                .map(String);
            const userOrgIds = [...new Set([directOrg, ...roleOrgValues].filter(Boolean))];
            if (!userOrgIds.includes(String(organization._id))) {
                return NextResponse.json(
                    { success: false, error: "You can only create seasons for your assigned organization" },
                    { status: 403 }
                );
            }
        }

        const body = await request.json();

        if (!body.name || !body.name.trim()) {
            return NextResponse.json(
                { success: false, error: "Season name is required" },
                { status: 400 }
            );
        }

        const seasonSlug = body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

        if (body.isDefault) {
            await Season.updateMany(
                { organization: organization._id, isDefault: true },
                { $set: { isDefault: false } },
            );
        }

        const season = await Season.create({
            organization: organization._id,
            name: body.name.trim(),
            slug: seasonSlug,
            type: body.type || "active",
            isDefault: body.isDefault || false,
        });

        return NextResponse.json(
            { success: true, data: season },
            { status: 201 }
        );
    } catch (error) {
        if (error.code === 11000) {
            return NextResponse.json(
                { success: false, error: "A season with this name already exists for this organization" },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
