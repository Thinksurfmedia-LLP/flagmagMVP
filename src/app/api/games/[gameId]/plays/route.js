import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Play from "@/models/Play";
import Game from "@/models/Game";

// Applies a score delta to a team atomically, so concurrent or rapid-fire
// play saves can never clobber each other's points the way a client-computed
// "read score, add delta, write absolute value" update can.
//
// Uses an aggregation-pipeline update (not a plain $inc) because every game
// starts with score: null (the "not yet played" placeholder — see Game.js),
// and MongoDB's $inc throws on a null field instead of treating it as 0.
// $ifNull coalesces null/missing to 0 before adding the delta, atomically,
// so the very first scoring play of a game never crashes.
//
// Must run in the same session/transaction as the Play write that triggered
// it — a play recorded without its score landing (or vice versa) is exactly
// the bug that left several completed games showing 0 despite a full,
// correct play log.
async function incTeamScore(gameId, targetTeam, delta, session) {
    if (!delta || !["A", "B"].includes(targetTeam)) return;
    const field = `team${targetTeam}.score`;
    await Game.findByIdAndUpdate(
        gameId,
        [{ $set: { [field]: { $add: [{ $ifNull: [`$${field}`, 0] }, delta] } } }],
        { updatePipeline: true, session },
    );
}

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

        const validTypes = ["completion", "incomplete", "interception", "fumble", "sack", "run", "timeout"];
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

        const ptsAdded = Number(body.ptsAdded) || 0;
        const targetTeam = body.targetTeam || "";

        const session = await mongoose.startSession();
        let play;
        try {
            await session.withTransaction(async () => {
                const [created] = await Play.create([{
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
                    ptsAdded,
                    targetTeam,
                }], { session });
                play = created;

                await incTeamScore(gameId, targetTeam, ptsAdded, session);
            });
        } finally {
            await session.endSession();
        }

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
        const validTypes = ["completion", "incomplete", "interception", "fumble", "sack", "run", "timeout"];

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

        // Snapshot the pre-update points/target so the score can be corrected by
        // the exact delta (old contribution removed, new contribution applied) —
        // never derived from client-side score state, which is what caused lost
        // points when plays were saved in quick succession.
        const before = await Play.findOne({ _id: playId, game: gameId }).select("ptsAdded targetTeam").lean();
        if (!before) {
            return NextResponse.json(
                { success: false, error: "Play not found" },
                { status: 404 }
            );
        }

        const oldPts = Number(before.ptsAdded) || 0;
        const oldTarget = before.targetTeam || "";
        const newPts = updates.ptsAdded !== undefined ? updates.ptsAdded : oldPts;
        const newTarget = updates.targetTeam !== undefined ? updates.targetTeam : oldTarget;

        const session = await mongoose.startSession();
        let updated;
        try {
            await session.withTransaction(async () => {
                updated = await Play.findOneAndUpdate(
                    { _id: playId, game: gameId },
                    { $set: updates },
                    { new: true, session }
                );

                if (oldTarget === newTarget) {
                    await incTeamScore(gameId, newTarget, newPts - oldPts, session);
                } else {
                    await incTeamScore(gameId, oldTarget, -oldPts, session);
                    await incTeamScore(gameId, newTarget, newPts, session);
                }
            });
        } finally {
            await session.endSession();
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

        const session = await mongoose.startSession();
        let deleted;
        try {
            await session.withTransaction(async () => {
                deleted = await Play.findOneAndDelete({ _id: playId, game: gameId }, { session });
                if (!deleted) return;
                await incTeamScore(gameId, deleted.targetTeam, -(Number(deleted.ptsAdded) || 0), session);
            });
        } finally {
            await session.endSession();
        }

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
