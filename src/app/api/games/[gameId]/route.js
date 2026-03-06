import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Game from "@/models/Game";
import { requireAdmin } from "@/lib/apiAuth";

// GET single game
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { gameId } = await params;
        const game = await Game.findById(gameId).lean();
        if (!game) {
            return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: game }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// UPDATE game (admin/organizer only)
export async function PUT(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { gameId } = await params;
        const body = await request.json();

        const game = await Game.findByIdAndUpdate(gameId, body, { new: true, runValidators: true });
        if (!game) {
            return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: game }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE game (admin/organizer only)
export async function DELETE(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { gameId } = await params;
        const game = await Game.findByIdAndDelete(gameId);
        if (!game) {
            return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, message: "Game deleted" }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
