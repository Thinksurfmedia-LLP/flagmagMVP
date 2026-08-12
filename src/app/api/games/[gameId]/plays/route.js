import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Play from "@/models/Play";
import Game from "@/models/Game";
import League from "@/models/League";
import Team from "@/models/Team";

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
        // Mongoose 9 requires this explicitly for any array (aggregation
        // pipeline) update — without it, findByIdAndUpdate throws "Cannot
        // pass an array to query updates unless the `updatePipeline` option
        // is set." on the very first scoring play of any game.
        { session, updatePipeline: true },
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

        // Defense-in-depth backstop for the same check on the "start match"
        // action (PUT /api/games/[gameId]) — catches any game that reached
        // in_progress before that check existed, or got there through some
        // other path. A play recorded against an empty roster has no real
        // player to attribute it to.
        const gameForRosterCheck = await Game.findById(gameId).select("league teamA teamB").lean();
        if (gameForRosterCheck?.league) {
            const league = await League.findById(gameForRosterCheck.league).select("organization").lean();
            if (league?.organization) {
                const [teamADoc, teamBDoc] = await Promise.all([
                    Team.findOne({ name: gameForRosterCheck.teamA?.name, organization: league.organization }).select("players").lean(),
                    Team.findOne({ name: gameForRosterCheck.teamB?.name, organization: league.organization }).select("players").lean(),
                ]);
                const empty = [];
                if (!teamADoc || (teamADoc.players || []).length === 0) empty.push(gameForRosterCheck.teamA?.name);
                if (!teamBDoc || (teamBDoc.players || []).length === 0) empty.push(gameForRosterCheck.teamB?.name);
                if (empty.length > 0) {
                    return NextResponse.json(
                        {
                            success: false,
                            error: `Can't record plays — ${empty.join(" and ")} ${empty.length > 1 ? "have" : "has"} no players on the roster. Add players to both teams first.`,
                        },
                        { status: 400 }
                    );
                }
            }
        }

        const ptsAdded = Number(body.ptsAdded) || 0;
        const targetTeam = body.targetTeam || "";
        const idempotencyKey = body.idempotencyKey || null;

        // Check for existing play with same idempotency key (prevent duplicates from retries)
        if (idempotencyKey) {
            const existing = await Play.findOne({ idempotencyKey, game: gameId }).lean();
            if (existing) {
                return NextResponse.json({ success: true, data: existing }, { status: 201 });
            }
        }

        // idempotencyKey is a sparse unique index — it's only safe to skip
        // duplicate-detection for plays that never carry one if the field is
        // truly absent from the document. Writing it as an explicit `null`
        // still counts as "present" to a sparse index, so only ONE play in
        // the entire collection could ever have a missing key before hitting
        // a duplicate-key error on every subsequent keyless play (exactly
        // what happened here). Spread it in only when a real key exists.

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
                    ...(idempotencyKey ? { idempotencyKey } : {}),
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
