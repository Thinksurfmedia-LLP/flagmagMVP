import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import Team from "@/models/Team";
import User from "@/models/User";
import { requireAdmin, requireAuth, hasRole } from "@/lib/apiAuth";
import { reconcilePlayerStatuses } from "@/lib/playerRosterSync";
import { runAfterResponseThrottled } from "@/lib/backgroundTask";
import { containsRegex } from "@/lib/searchRegex";

const RECONCILE_INTERVAL_MS = 5 * 60 * 1000;

// ?view=picker — just what the Teams page "Assign an Existing Player" picker
// reads, as a search: one page of name matches, never the whole org. After
// the legacy imports XFlagFootball alone has ~55k players; pulling them all
// (even slimmed to these fields) took ~67s and tripped the proxy timeout.
const PICKER_FIELDS = "name organization status";
const PICKER_DEFAULT_LIMIT = 50;
const PICKER_MAX_LIMIT = 100;

function parsePickerLimit(raw) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return PICKER_DEFAULT_LIMIT;
    return Math.min(n, PICKER_MAX_LIMIT);
}

// Organizer's org from the live user record (the JWT's can be stale).
async function getUserOrgId(authUser) {
    const dbUser =
        (await User.findById(authUser._id).select("organization roleOrganizations").lean()) ||
        (await User.findOne({ email: authUser.email }).select("organization roleOrganizations").lean());
    if (dbUser?.organization) return dbUser.organization;
    const organizerOrgs = dbUser?.roleOrganizations?.organizer;
    return Array.isArray(organizerOrgs) ? organizerOrgs[0] || null : organizerOrgs || null;
}

// Self-heal: Team.players (roster membership) and Player.status can drift
// apart if a write is interrupted or races with another edit. Every roster
// write already reconciles the players it touches, so this is a safety net —
// run after the response (and scoped to the org when there is one) instead
// of making every load wait on a pass over every team and player in the DB.
function scheduleReconcile(orgId) {
    runAfterResponseThrottled(`players-reconcile:${orgId || "all"}`, RECONCILE_INTERVAL_MS, async () => {
        if (!orgId) return reconcilePlayerStatuses();
        const orgPlayerIds = await Player.distinct("_id", { organization: orgId });
        if (orgPlayerIds.length > 0) await reconcilePlayerStatuses(orgPlayerIds);
    });
}

// GET all players
// Optional: ?status=free_agent|player  ?search=<name>  ?view=picker
export async function GET(request) {
    try {
        // Require authentication to view players
        const auth = await requireAuth();
        if (!auth.authorized) return auth.response;

        await dbConnect();

        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search");
        const status = searchParams.get("status");
        const isPicker = searchParams.get("view") === "picker";

        const filter = {};

        // Filter by status if provided; default shows all
        if (status) {
            filter.status = status;
        }

        const searchRe = containsRegex(search);
        if (searchRe) filter.name = searchRe;

        // Organizers (not admins) only see their organization's players:
        // anyone rostered on one of its teams, plus anyone whose own
        // organization field is set to it.
        let orgId = null;
        if (!hasRole(auth.user, "admin")) {
            orgId = await getUserOrgId(auth.user);
            if (orgId) {
                const rosteredIds = await Team.distinct("players.player", { organization: orgId });
                filter.$or = [{ organization: orgId }, { _id: { $in: rosteredIds.filter(Boolean) } }];
            }
        }

        scheduleReconcile(orgId);

        if (isPicker) {
            // Narrow to the team's own org. ANDed with the organizer scope
            // above, so it can only shrink what the caller may already see.
            const pickerOrg = searchParams.get("organization");
            if (pickerOrg) {
                if (!mongoose.isValidObjectId(pickerOrg)) {
                    return NextResponse.json({ success: false, error: "Invalid organization" }, { status: 400 });
                }
                filter.organization = pickerOrg;
            }
            const limit = parsePickerLimit(searchParams.get("limit"));
            // One extra row tells the picker whether to say "keep typing".
            const rows = await Player.find(filter).select(PICKER_FIELDS).sort({ name: 1 }).limit(limit + 1).lean();
            const hasMore = rows.length > limit;
            const players = hasMore ? rows.slice(0, limit) : rows;
            return NextResponse.json({ success: true, count: players.length, hasMore, data: players }, { status: 200 });
        }

        const players = await Player.find(filter)
            .populate("organization", "name slug")
            .sort({ name: 1 })
            .lean();

        // Extra: map jersey numbers from Team collection
        const playerIds = players.map(p => p._id);
        const teams = await Team.find({ "players.player": { $in: playerIds } })
            .select("players.player players.jerseyNumber")
            .lean();
        const jerseyMap = {};
        for (const team of teams) {
            for (const p of (team.players || [])) {
                if (p.player) jerseyMap[p.player.toString()] = p.jerseyNumber;
            }
        }

        const data = players.map((p) => ({ ...p, jerseyNumber: jerseyMap[p._id.toString()] || null }));

        return NextResponse.json({ success: true, count: data.length, data }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// CREATE player (admin/organizer only)
export async function POST(request) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const body = await request.json();
        const player = await Player.create(body);
        return NextResponse.json({ success: true, data: player }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
