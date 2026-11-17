import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";
import { getManagedOrgIds } from "@/lib/managedOrgs";
import { ARCHIVE_KINDS, buildArchiveFilter, archiveSearchRegex } from "@/lib/archivePlayersFilter";
import { playerIdentifiers } from "@/lib/playerMerge";
import { MAX_MERGE_SOURCES } from "@/lib/playerMergePlan";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value, fallback) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

// GET /api/players/archive?page=1&limit=50&search=&kind=all|jersey|named[&organization=<id>][&view=selection]
// Players imported from the old XFlag site who aren't on a current roster —
// kept out of Free Agents (they never signed up). Each row carries its teams
// and last season played so records can be told apart, merged or renamed.
// view=selection: every match (up to one merge's worth) as {_id, name,
// organization} — backs "Select all matching", e.g. every "Darkside #56".
export async function GET(request) {
    const auth = await requireAnyPermission(["manage_players", "player_view", "player_update"]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const page = parsePositiveInt(searchParams.get("page"), 1);
        const limit = Math.min(parsePositiveInt(searchParams.get("limit"), DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE);
        const kind = ARCHIVE_KINDS.includes(searchParams.get("kind")) ? searchParams.get("kind") : "all";

        let orgIds = null;
        if (!hasRole(auth.user, "admin")) {
            orgIds = [...(await getManagedOrgIds(auth.user))];
            if (orgIds.length === 0) {
                return NextResponse.json({ success: false, error: "You are not assigned to an organization" }, { status: 400 });
            }
        }
        const requestedOrg = searchParams.get("organization");
        if (requestedOrg) {
            if (!mongoose.isValidObjectId(requestedOrg)) {
                return NextResponse.json({ success: false, error: "Invalid organization" }, { status: 400 });
            }
            if (orgIds && !orgIds.includes(requestedOrg)) {
                return NextResponse.json({ success: false, error: "You can only view your organization's players" }, { status: 403 });
            }
            orgIds = [requestedOrg];
        }

        const filter = buildArchiveFilter({
            orgIds: orgIds && orgIds.map((id) => new mongoose.Types.ObjectId(id)),
            kind,
            searchRe: archiveSearchRegex(searchParams.get("search")),
        });

        if (searchParams.get("view") === "selection") {
            const [total, rows] = await Promise.all([
                Player.countDocuments(filter),
                Player.find(filter).select("name organization").sort({ name: 1, _id: 1 }).limit(MAX_MERGE_SOURCES).lean(),
            ]);
            return NextResponse.json({ success: true, data: rows, meta: { total, limit: MAX_MERGE_SOURCES } });
        }
        const [total, rows] = await Promise.all([
            Player.countDocuments(filter),
            Player.find(filter)
                .select("name photo email phone organization status")
                .populate("organization", "name slug")
                .sort({ name: 1, _id: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
        ]);
        const identifiers = await playerIdentifiers(rows);
        const data = rows.map((p) => ({ ...p, ...identifiers.get(String(p._id)) }));

        return NextResponse.json({
            success: true,
            data,
            meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
        });
    } catch (error) {
        console.error("[players/archive] failed:", error);
        return NextResponse.json({ success: false, error: "Couldn't load archive players" }, { status: 500 });
    }
}
