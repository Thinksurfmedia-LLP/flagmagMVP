import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Game from "@/models/Game";
import { requireAdmin } from "@/lib/apiAuth";

// GET games for a season
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const date = searchParams.get("date");

        const filter = { season: id };
        if (status) filter.status = status;
        if (date) {
            const d = new Date(date);
            filter.date = {
                $gte: new Date(d.setHours(0, 0, 0, 0)),
                $lt: new Date(d.setHours(23, 59, 59, 999)),
            };
        }

        const games = await Game.find(filter).sort({ date: 1, time: 1 }).lean();

        return NextResponse.json(
            { success: true, count: games.length, data: games },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// CREATE game in a season (admin/organizer only)
export async function POST(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const body = await request.json();
        body.season = id;

        const game = await Game.create(body);

        return NextResponse.json({ success: true, data: game }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
