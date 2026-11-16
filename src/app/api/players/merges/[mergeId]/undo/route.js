import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import PlayerMerge from "@/models/PlayerMerge";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";
import { getManagedOrgIds } from "@/lib/managedOrgs";
import { undoMerge } from "@/lib/playerMerge";

// POST /api/players/merges/:mergeId/undo — restore the merged-away player
// records and move their stats back (see lib/playerMerge.js).
export async function POST(request, { params }) {
    const auth = await requireAnyPermission(["manage_players", "player_update"]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { mergeId } = await params;
        if (!mongoose.isValidObjectId(mergeId)) {
            return NextResponse.json({ success: false, error: "Invalid merge" }, { status: 400 });
        }
        const log = await PlayerMerge.findById(mergeId).select("organization").lean();
        if (!log) {
            return NextResponse.json({ success: false, error: "Merge not found" }, { status: 404 });
        }
        if (!hasRole(auth.user, "admin")) {
            const orgIds = await getManagedOrgIds(auth.user);
            if (!log.organization || !orgIds.has(String(log.organization))) {
                return NextResponse.json({ success: false, error: "You can only manage players in your organization" }, { status: 403 });
            }
        }

        const result = await undoMerge({ mergeId, actorId: auth.user.id });
        if (!result.ok) {
            return NextResponse.json({ success: false, error: result.error }, { status: result.status });
        }
        return NextResponse.json({ success: true, data: { restored: result.restored } });
    } catch (error) {
        console.error("[players/merges/undo] failed:", error);
        return NextResponse.json({ success: false, error: "Undo failed — nothing was changed. Please try again." }, { status: 500 });
    }
}
