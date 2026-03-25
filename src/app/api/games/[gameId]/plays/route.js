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

// PUT — update a specific play by _id (passed as query param ?playId=xxx)
export async function PUT(request, { params }) {
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

        const body = await request.json();
        const validTypes = ["completion", "incomplete", "interception", "fumble", "sack", "run"];

        const updates = {};
        if (body.type !== undefined) {
            if (!validTypes.includes(body.type)) {
                return NextResponse.json(
                    { success: false, error: "Invalid play type" },
                    { status: 400 }
                );
            }
            updates.type = body.type;
        }
        if (body.activeTeam !== undefined) {
            if (!["A", "B"].includes(body.activeTeam)) {
                return NextResponse.json(
                    { success: false, error: "activeTeam must be A or B" },
                    { status: 400 }
                );
            }
            updates.activeTeam = body.activeTeam;
        }
        if (body.teamName !== undefined) updates.teamName = body.teamName;
        if (body.half !== undefined) updates.half = body.half;
        if (body.passer !== undefined) updates.passer = body.passer;
        if (body.receiver !== undefined) updates.receiver = body.receiver;
        if (body.rusher !== undefined) updates.rusher = body.rusher;
        if (body.defender !== undefined) updates.defender = body.defender;
        if (body.flagPull !== undefined) updates.flagPull = body.flagPull;
        if (body.yards !== undefined) updates.yards = Number(body.yards) || 0;
        if (body.points !== undefined) updates.points = body.points;
        if (body.safety !== undefined) updates.safety = Boolean(body.safety);
        if (body.ptsAdded !== undefined) updates.ptsAdded = Number(body.ptsAdded) || 0;
        if (body.targetTeam !== undefined) updates.targetTeam = body.targetTeam;

        const updated = await Play.findOneAndUpdate(
            { _id: playId, game: gameId },
            { $set: updates },
            { new: true }
        );

        if (!updated) {
            return NextResponse.json(
                { success: false, error: "Play not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: updated });
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
