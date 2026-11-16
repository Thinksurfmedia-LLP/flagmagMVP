import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";
import { getManagedOrgIds } from "@/lib/managedOrgs";
import { parseMergeRequest } from "@/lib/playerMergePlan";
import { previewMerge, mergePlayers, listMergesInto } from "@/lib/playerMerge";

const SHARED_GAMES_SHOWN = 5;

// POST /api/players/:id/merge  { sourceIds: [...], dryRun?: boolean }
// Merges the listed player records INTO :id (the player that is kept): their
// stats, plays and awards move to :id and the records are removed. Fully
// logged and reversible — see lib/playerMerge.js and
// POST /api/players/merges/:mergeId/undo.
// dryRun: check only, and return each record's teams/seasons so the organizer
// can confirm they picked the right ones.
// The caller must manage the kept player's organization (admins: any).
// Returns the player, or a NextResponse to send back.
async function authorizeTarget(auth, playerId) {
    const target = await Player.findById(playerId).select("organization").lean();
    if (!target) return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 });
    if (!hasRole(auth.user, "admin")) {
        const orgIds = await getManagedOrgIds(auth.user);
        if (!target.organization || !orgIds.has(String(target.organization))) {
            return NextResponse.json({ success: false, error: "You can only manage players in your organization" }, { status: 403 });
        }
    }
    return target;
}

// GET /api/players/:id/merge — earlier merges into this player that can
// still be undone (so a mistake can be reversed after the dialog closed).
export async function GET(request, { params }) {
    const auth = await requireAnyPermission(["manage_players", "player_update"]);
    if (!auth.authorized) return auth.response;
    try {
        await dbConnect();
        const { id } = await params;
        if (!mongoose.isValidObjectId(id)) {
            return NextResponse.json({ success: false, error: "Invalid player" }, { status: 400 });
        }
        const target = await authorizeTarget(auth, id);
        if (target instanceof NextResponse) return target;
        return NextResponse.json({ success: true, data: await listMergesInto(id) });
    } catch (error) {
        console.error("[players/merge] list failed:", error);
        return NextResponse.json({ success: false, error: "Couldn't load earlier merges" }, { status: 500 });
    }
}

export async function POST(request, { params }) {
    const auth = await requireAnyPermission(["manage_players", "player_update"]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { id } = await params;
        const body = await request.json().catch(() => null);
        const parsed = parseMergeRequest(id, body?.sourceIds);
        if (!parsed.ok) {
            return NextResponse.json({ success: false, error: parsed.error }, { status: 400 });
        }

        const target = await authorizeTarget(auth, parsed.targetId);
        if (target instanceof NextResponse) return target;

        if (body?.dryRun) {
            const preview = await previewMerge(parsed.targetId, parsed.sourceIds);
            // Records from another organization only get a blocker, never
            // their details — the caller may not manage that organization.
            const targetOrg = String(target.organization || "");
            const describe = (p) => {
                if (!p) return p;
                if (String(p.organization || "") !== targetOrg) return { _id: p._id, name: "(another organization)", photo: "", history: null };
                return { _id: p._id, name: p.name, photo: p.photo || "", history: preview.histories.get(String(p._id)) || null };
            };
            return NextResponse.json({
                success: true,
                data: {
                    target: describe(preview.target),
                    sources: preview.sources.map(describe),
                    blockers: preview.blockers,
                    sharedGames: preview.sharedGames.slice(0, SHARED_GAMES_SHOWN),
                },
            });
        }

        const result = await mergePlayers({
            targetId: parsed.targetId,
            sourceIds: parsed.sourceIds,
            actorId: auth.user.id,
        });
        if (!result.ok) {
            return NextResponse.json({ success: false, error: result.error, blockers: result.blockers || [] }, { status: result.status });
        }
        return NextResponse.json({ success: true, data: { mergeId: result.mergeId, merged: result.merged } });
    } catch (error) {
        console.error("[players/merge] failed:", error);
        return NextResponse.json({ success: false, error: "Merging failed — nothing was changed. Please try again." }, { status: 500 });
    }
}
