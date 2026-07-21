import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Schedule from "@/models/Schedule";
import { requireAnyPermission } from "@/lib/apiAuth";

// GET week names for a league's schedule (used to tag a game with its week when creating it)
export async function GET(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_games", "game_create", "game_view", "stats_record"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;

        const schedule = await Schedule.findOne({ leagueId: id }).select("weeks.name").lean();
        const weekNames = (schedule?.weeks || []).map((w) => w.name).filter(Boolean);

        return NextResponse.json({ success: true, data: weekNames });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
