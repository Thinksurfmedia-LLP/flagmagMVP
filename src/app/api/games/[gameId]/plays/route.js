import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Play from "@/models/Play";

// GET all plays for a game
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { gameId } = await params;
        const plays = await Play.find({ game: gameId }).sort({ createdAt: 1 }).lean();
        return NextResponse.json({ success: true, data: plays });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST — save a single play
export async function POST(request, { params }) {
    try {
        await dbConnect();
        const { gameId } = await params;
        const body = await request.json();

        const validTypes = ["completion", "incomplete", "interception", "fumble", "sack", "run"];
        if (!body.type || !validTypes.includes(body.type)) {
            return NextResponse.json(
                { success: false, error: "Invalid play type" },
                { status: 400 }
            );
        }
        if (!body.activeTeam || !["A", "B"].includes(body.activeTeam)) {
            return NextResponse.json(
                { success: false, error: "activeTeam (A or B) is required" },
                { status: 400 }
            );
        }
        if (!body.teamName) {
            return NextResponse.json(
                { success: false, error: "teamName is required" },
                { status: 400 }
            );
        }

        const play = await Play.create({
            game: gameId,
            type: body.type,
            activeTeam: body.activeTeam,
            teamName: body.teamName,
            half: body.half || "1st",
            passer: body.passer || "",
            receiver: body.receiver || "",
            rusher: body.rusher || "",
            defender: body.defender || "",
            flagPull: body.flagPull || "",
            yards: Number(body.yards) || 0,
            points: body.points || "",
            safety: Boolean(body.safety),
            ptsAdded: Number(body.ptsAdded) || 0,
            targetTeam: body.targetTeam || "",
        });

        return NextResponse.json({ success: true, data: play }, { status: 201 });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE — delete a specific play by _id (passed as query param ?playId=xxx)
export async function DELETE(request, { params }) {
    try {
        await dbConnect();
        const { gameId } = await params;
        const { searchParams } = new URL(request.url);
        const playId = searchParams.get("playId");

        if (!playId) {
            return NextResponse.json(
                { success: false, error: "playId query parameter is required" },
                { status: 400 }
            );
        }

        const deleted = await Play.findOneAndDelete({ _id: playId, game: gameId });
        if (!deleted) {
            return NextResponse.json(
                { success: false, error: "Play not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
