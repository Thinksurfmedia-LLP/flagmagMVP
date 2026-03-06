import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Season from "@/models/Season";
import { requireAdmin } from "@/lib/apiAuth";

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
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const body = await request.json();

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
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const season = await Season.findByIdAndDelete(id);

        if (!season) {
            return NextResponse.json(
                { success: false, error: "Season not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, message: "Season deleted" }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
