import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import User from "@/models/User";
import Player from "@/models/Player";
import { requireAdmin } from "@/lib/apiAuth";
import { validateTeamJerseyRequests, pushPlayerAtomic, inTransaction, RosterConflictError } from "@/lib/teamJerseyGuard";

// GET players for an organization (through user.organization)
export async function GET(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { slug } = await params;

        const org = await Organization.findOne({ slug }).lean();
        if (!org) {
            return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
        }

        // Find users belonging to this org
        const orgUsers = await User.find({ organization: org._id }).select("_id").lean();
        const userIds = orgUsers.map(u => u._id);

        // Find players linked to those users
        const players = await Player.find({ user: { $in: userIds } }).sort({ name: 1 }).lean();

        return NextResponse.json({ success: true, count: players.length, data: players }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// CREATE player for this org
export async function POST(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { slug } = await params;

        const org = await Organization.findOne({ slug }).lean();
        if (!org) {
            return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
        }

        const body = await request.json();

        // If a userId is provided, ensure it belongs to this org
        if (body.user) {
            const linkedUser = await User.findById(body.user).lean();
            if (!linkedUser || String(linkedUser.organization) !== String(org._id)) {
                return NextResponse.json({ success: false, error: "User does not belong to this organization" }, { status: 403 });
            }
        }

        const { teams, ...playerData } = body;
        
        // Ensure status is player if teams are assigned
        if (teams && teams.length > 0) {
            playerData.status = "player";
        }

        const TeamModel = require("@/models/Team").default || require("mongoose").models.Team;

        // Validate every requested jersey number BEFORE creating the player,
        // so a conflict doesn't leave an orphaned player behind. This push
        // used to be unchecked (and turned a blank number into 0) — one of
        // the paths that let duplicate jerseys into Team.players.
        const jerseyCheck = await validateTeamJerseyRequests(TeamModel, teams, null);
        if (!jerseyCheck.ok) {
            return NextResponse.json({ success: false, error: jerseyCheck.error }, { status: jerseyCheck.status });
        }

        // Player + every roster push in one transaction, each push an atomic
        // check-and-write — if another request takes one of these numbers in
        // the meantime, nothing is saved (no orphaned player, no duplicate).
        const player = await inTransaction(async (session) => {
            const [created] = await Player.create([playerData], { session });
            let firstTeam = null;
            for (const tReq of teams || []) {
                const jNum = jerseyCheck.numbers.get(String(tReq.teamId));
                if (jNum === undefined) continue; // team no longer exists
                const team = await TeamModel.findById(tReq.teamId).select("name logo").session(session).lean();
                await pushPlayerAtomic(TeamModel, { teamId: tReq.teamId, teamName: team?.name || "this team", playerId: created._id, jerseyNumber: jNum, session });
                if (!firstTeam) firstTeam = team;
            }
            if (firstTeam) {
                created.presentTeam = { name: firstTeam.name, logo: firstTeam.logo || "" };
                await created.save({ session });
            }
            return created;
        });

        return NextResponse.json({ success: true, data: player }, { status: 201 });
    } catch (error) {
        if (error instanceof RosterConflictError) {
            return NextResponse.json({ success: false, code: "ROSTER_CONFLICT", error: error.message }, { status: 409 });
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
