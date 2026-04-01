import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Game from "@/models/Game";
import League from "@/models/League";
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

        // Validate against league start date
        if (body.date) {
            const existing = await Game.findById(gameId).select("league").lean();
            const leagueId = body.league || existing?.league;
            if (leagueId) {
                const league = await League.findById(leagueId).select("startDate").lean();
                if (league?.startDate) {
                    const gameDate = new Date(body.date);
                    const startDate = new Date(league.startDate);
                    gameDate.setHours(0, 0, 0, 0);
                    startDate.setHours(0, 0, 0, 0);
                    if (gameDate < startDate) {
                        return NextResponse.json(
                            { success: false, error: `Game date cannot be before the league start date (${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})` },
                            { status: 400 }
                        );
                    }
                }
            }
        }

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
