import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Season from "@/models/Season";
import User from "@/models/User";
import { requireAnyPermission } from "@/lib/apiAuth";

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
        }

        // Only allow updating season-specific fields
        const updates = {};
        if (body.name !== undefined) updates.name = body.name;
        if (body.type !== undefined) updates.type = body.type;
        if (body.isDefault !== undefined) updates.isDefault = body.isDefault;

        // If setting as default, unset other defaults for this org
        if (updates.isDefault) {
            await Season.updateMany(
                { organization: existingSeason.organization, _id: { $ne: id }, isDefault: true },
                { $set: { isDefault: false } },
            );
        }

        const season = await Season.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
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
