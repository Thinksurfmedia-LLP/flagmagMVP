import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { requireAdmin } from "@/lib/apiAuth";

const VALID_ROLES = ["player", "organizer", "admin"];
const VALID_PERMISSIONS = [
    "manage_organizations",
    "manage_seasons",
    "manage_games",
    "manage_players",
    "manage_users",
    "view_dashboard",
];

export async function PUT(request, { params }) {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    // Only true admins can change roles/permissions
    if (auth.user.role !== "admin") {
        return NextResponse.json(
            { success: false, error: "Only admins can manage user roles" },
            { status: 403 }
        );
    }

    try {
        await dbConnect();
        const { id } = await params;
        const body = await request.json();
        const update = {};

        if (body.role) {
            if (!VALID_ROLES.includes(body.role)) {
                return NextResponse.json(
                    { success: false, error: "Invalid role" },
                    { status: 400 }
                );
            }
            update.role = body.role;
        }

        if (body.permissions) {
            if (!Array.isArray(body.permissions) || !body.permissions.every(p => VALID_PERMISSIONS.includes(p))) {
                return NextResponse.json(
                    { success: false, error: "Invalid permissions" },
                    { status: 400 }
                );
            }
            update.permissions = body.permissions;
        }

        const user = await User.findByIdAndUpdate(id, update, { new: true, runValidators: true })
            .select("-password")
            .lean();

        if (!user) {
            return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: user });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
