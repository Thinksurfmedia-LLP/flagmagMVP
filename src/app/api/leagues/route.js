import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import League from "@/models/League";
import Organization from "@/models/Organization";
import User from "@/models/User";
import { requireAnyPermission } from "@/lib/apiAuth";

// GET all leagues (admin sees all; organizer sees own org's)
export async function GET(request) {
    try {
        const auth = await requireAnyPermission([
            "manage_leagues", "league_view", "league_create", "league_update", "league_delete",
        ]);
        if (!auth.authorized) return auth.response;

        await dbConnect();

        const { searchParams } = new URL(request.url);
        const orgId = searchParams.get("organization");
        const search = searchParams.get("search");
        const type = searchParams.get("type");

        const filter = {};

        if (auth.user.role === "admin") {
            if (orgId) filter.organization = orgId;
        } else {
            const currentUser = await User.findById(auth.user.id).select("organization roleOrganizations").lean();
            const directOrg = currentUser?.organization ? String(currentUser.organization) : null;
            const roleOrgValues = Object.values(currentUser?.roleOrganizations || {})
                .flatMap(v => Array.isArray(v) ? v : [v])
                .map(String);
            const userOrgIds = [...new Set([directOrg, ...roleOrgValues].filter(Boolean))];
            if (!userOrgIds.length) {
                return NextResponse.json({ success: true, data: [] });
            }
            filter.organization = { $in: userOrgIds };
        }

        if (search) filter.name = { $regex: search, $options: "i" };
        if (type) filter.type = type;

        const leagues = await League.find(filter)
            .populate("organization", "name slug")
            .populate("season", "name")
            .sort({ createdAt: -1 })
            .lean();

        return NextResponse.json({ success: true, data: leagues });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST create a league
export async function POST(request) {
    try {
        const auth = await requireAnyPermission(["manage_leagues", "league_create"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const body = await request.json();

        if (!body.name || !body.name.trim()) {
            return NextResponse.json({ success: false, error: "League name is required" }, { status: 400 });
        }

        if (!body.organization) {
            return NextResponse.json({ success: false, error: "Organization is required" }, { status: 400 });
        }

        const organization = await Organization.findById(body.organization);
        if (!organization) {
            return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
        }

        // Organizers can only create leagues for their own org
        if (auth.user.role !== "admin") {
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

        const slug = body.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

        const locations = Array.isArray(body.locations)
            ? body.locations.map((s) => String(s).trim()).filter(Boolean)
            : [];

        const league = await League.create({
            organization: organization._id,
            name: body.name.trim(),
            slug,
            type: body.type || "active",
            category: body.category || "",
            locations,
            location: locations[0] || "",
            startDate: body.startDate || undefined,
            endDate: body.endDate || undefined,
            season: body.season || undefined,
            seasonOverridden: body.seasonOverridden || false,
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
