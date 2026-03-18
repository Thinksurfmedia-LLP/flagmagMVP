import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Notification from "@/models/Notification";
import { requireAnyPermission } from "@/lib/apiAuth";

// GET notifications (admin only)
export async function GET(request) {
    try {
        const auth = await requireAnyPermission(["manage_organizations"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();

        const { searchParams } = new URL(request.url);
        const unreadOnly = searchParams.get("unread") === "true";

        const filter = {};
        if (unreadOnly) filter.read = false;

        const notifications = await Notification.find(filter)
            .populate("organization", "name slug")
            .populate("triggeredBy", "name email")
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        return NextResponse.json({ success: true, data: notifications });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST create a notification (authenticated users)
export async function POST(request) {
    try {
        const auth = await requireAnyPermission([
            "manage_organizations", "manage_leagues", "league_create", "league_update",
        ]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const body = await request.json();

        if (!body.type || !body.message) {
            return NextResponse.json(
                { success: false, error: "type and message are required" },
                { status: 400 }
            );
        }

        const notification = await Notification.create({
            type: body.type,
            message: body.message,
            organization: body.organization || undefined,
            triggeredBy: auth.user.id,
            meta: body.meta || {},
        });

        return NextResponse.json({ success: true, data: notification }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
