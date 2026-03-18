import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import { requireAdmin } from "@/lib/apiAuth";

// GET all players
export async function GET(request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search");
        const status = searchParams.get("status");

        const filter = {};

        // Filter by status if provided; default shows all
        if (status) {
            filter.status = status;
        }

        if (search) {
            filter.name = { $regex: search, $options: "i" };
        }

        const players = await Player.find(filter)
            .populate("organization", "name slug")
            .sort({ name: 1 })
            .lean();
        return NextResponse.json({ success: true, count: players.length, data: players }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// CREATE player (admin/organizer only)
export async function POST(request) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const body = await request.json();
        const player = await Player.create(body);
        return NextResponse.json({ success: true, data: player }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
