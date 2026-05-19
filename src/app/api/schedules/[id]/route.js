import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Schedule from "@/models/Schedule";
import User from "@/models/User";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";
import { logActivity } from "@/lib/activityLogger";

// GET single schedule
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { id } = await params;
        const schedule = await Schedule.findById(id)
            .populate("organization", "name slug logo")
            .populate("leagueId", "name image")
            .populate("locationId", "name address")
            .populate("weeks.games.team1", "name logo")
            .populate("weeks.games.team2", "name logo")
            .lean();

        if (!schedule) {
            return NextResponse.json(
                { success: false, error: "Schedule not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { success: true, data: schedule },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// UPDATE schedule
export async function PUT(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_schedules", "schedule_update"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const body = await request.json();

        const existingSchedule = await Schedule.findById(id).select("organization scheduleLabel").lean();
        if (!existingSchedule) {
            return NextResponse.json(
                { success: false, error: "Schedule not found" },
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
            if (!userOrgIds.includes(String(existingSchedule.organization))) {
                return NextResponse.json(
                    { success: false, error: "You can only update schedules for your assigned organization" },
                    { status: 403 }
                );
            }
        }

        const updates = {};
        if (body.scheduleLabel !== undefined) updates.scheduleLabel = body.scheduleLabel;
        if (body.locationName !== undefined) updates.locationName = body.locationName;
        if (body.status !== undefined) updates.status = body.status;
        if (body.leagueId !== undefined) updates.leagueId = body.leagueId;
        if (body.locationId !== undefined) updates.locationId = body.locationId;
        
        if (body.weeks && Array.isArray(body.weeks)) {
            updates.weeks = body.weeks.map(week => ({
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

        const schedule = await Schedule.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
        if (!schedule) {
            return NextResponse.json(
                { success: false, error: "Schedule not found" },
                { status: 404 }
            );
        }

        await logActivity({
            userId: auth.user.id,
            role: auth.user.role || auth.user.roles?.[0] || "unknown",
            action: "UPDATED_SCHEDULE",
            details: `Updated schedule '${schedule.scheduleLabel}'`,
            organization: schedule.organization
        });

        return NextResponse.json({ success: true, data: schedule }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE schedule
export async function DELETE(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_schedules", "schedule_delete"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const schedule = await Schedule.findById(id).select("organization scheduleLabel");

        if (!schedule) {
            return NextResponse.json(
                { success: false, error: "Schedule not found" },
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
            if (!userOrgIds.includes(String(schedule.organization))) {
                return NextResponse.json(
                    { success: false, error: "You can only delete schedules for your assigned organization" },
                    { status: 403 }
                );
            }
        }

        await Schedule.deleteOne({ _id: id });

        await logActivity({
            userId: auth.user.id,
            role: auth.user.role || auth.user.roles?.[0] || "unknown",
            action: "DELETED_SCHEDULE",
            details: `Deleted schedule '${schedule.scheduleLabel}'`,
            organization: schedule.organization
        });

        return NextResponse.json({ success: true, message: "Schedule deleted" }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
