import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import { requireAdmin } from "@/lib/apiAuth";

// GET single player
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { id } = await params;
        const player = await Player.findById(id).lean();

        if (!player) {
            return NextResponse.json(
                { success: false, error: "Player not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: player }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// UPDATE player (admin/organizer only)
export async function PUT(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const body = await request.json();

        const player = await Player.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        if (!player) {
            return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: player }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE player (admin/organizer only)
export async function DELETE(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const player = await Player.findByIdAndDelete(id);
        if (!player) {
            return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, message: "Player deleted" }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
