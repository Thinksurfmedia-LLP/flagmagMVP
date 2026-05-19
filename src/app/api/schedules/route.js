import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Schedule from "@/models/Schedule";
import Organization from "@/models/Organization";
import User from "@/models/User";
import { requireAnyPermission } from "@/lib/apiAuth";
import { logActivity } from "@/lib/activityLogger";

// GET all schedules
export async function GET(request) {
    try {
        const auth = await requireAnyPermission([
            "manage_schedules", "schedule_view", "schedule_create", "schedule_update", "schedule_delete",
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

        if (search) {
            filter.$or = [
                { scheduleLabel: { $regex: search, $options: "i" } },
                { locationName: { $regex: search, $options: "i" } },
            ];
        }

        const schedules = await Schedule.find(filter)
            .populate("organization", "name slug")
            .populate("leagueId", "name image")
            .populate("locationId", "name address")
            .populate("weeks.games.team1", "name logo")
            .populate("weeks.games.team2", "name logo")
            .sort({ createdAt: -1 })
            .lean();

        return NextResponse.json({ success: true, data: schedules });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST create a schedule
export async function POST(request) {
    try {
        const auth = await requireAnyPermission(["manage_schedules", "schedule_create"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const body = await request.json();

        if (!body.scheduleLabel || !body.scheduleLabel.trim()) {
            return NextResponse.json({ success: false, error: "Schedule label is required" }, { status: 400 });
        }

        if (!body.locationName || !body.locationName.trim()) {
            return NextResponse.json({ success: false, error: "Location name is required" }, { status: 400 });
        }

        if (!body.organization) {
            return NextResponse.json({ success: false, error: "Organization is required" }, { status: 400 });
        }

        const organization = await Organization.findById(body.organization);
        if (!organization) {
            return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
        }

        // Organizers can only create schedules for their own org
        if (auth.user.role !== "admin") {
            const currentUser = await User.findById(auth.user.id).select("organization roleOrganizations").lean();
            const directOrg = currentUser?.organization ? String(currentUser.organization) : null;
            const roleOrgValues = Object.values(currentUser?.roleOrganizations || {})
                .flatMap(v => Array.isArray(v) ? v : [v])
                .map(String);
            const userOrgIds = [...new Set([directOrg, ...roleOrgValues].filter(Boolean))];
            if (!userOrgIds.includes(String(organization._id))) {
                return NextResponse.json(
                    { success: false, error: "You can only create schedules for your assigned organization" },
                    { status: 403 },
                );
            }
        }

        const payload = {
            organization: organization._id,
            scheduleLabel: body.scheduleLabel.trim(),
            locationName: body.locationName.trim(),
            status: body.status || "Active",
        };

        if (body.leagueId) payload.leagueId = body.leagueId;
        if (body.locationId) payload.locationId = body.locationId;
        if (body.weeks && Array.isArray(body.weeks)) {
            payload.weeks = body.weeks.map(week => ({
                name: week.name || "",
                games: Array.isArray(week.games) ? week.games.map(game => ({
                    team1: game.team1 || null,
                    team2: game.team2 || null,
                    field: game.field || "",
                    date: game.date || "",
                    time: game.time || "",
                })) : []
            }));
        }

        const schedule = await Schedule.create(payload);

        await logActivity({
            userId: auth.user.id,
            role: auth.user.role || auth.user.roles?.[0] || "unknown",
            action: "CREATED_SCHEDULE",
            details: `Created new schedule ${schedule.scheduleLabel} for organization ${organization.name}`,
            organization: organization._id
        });

        return NextResponse.json({ success: true, data: schedule }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
