import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Team from "@/models/Team";
import League from "@/models/League";
import Game from "@/models/Game";
import Play from "@/models/Play";
import Player from "@/models/Player";
import User from "@/models/User";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";
import { getFieldSides } from "@/lib/statsAggregation";

async function getOrgIdForOrganizer(authUser) {
    if (authUser.organization?.id) return authUser.organization.id;
    const userDoc = await User.findById(authUser.id).select("organization roleOrganizations").lean()
        || await User.findOne({ email: authUser.email }).select("organization roleOrganizations").lean();
    if (userDoc?.roleOrganizations?.organizer) {
        const orgs = userDoc.roleOrganizations.organizer;
        if (Array.isArray(orgs) && orgs.length > 0) return String(orgs[0]);
        if (typeof orgs === "string") return String(orgs);
    }
    return userDoc?.organization ? String(userDoc.organization) : null;
}

// GET — every player who has EVER recorded a stat for this team (via the
// frozen `<field>Player` ids on Play — see statsAggregation.js), across every
// season/league it's played in, plus everyone currently on its roster. Used
// to populate the retired-numbers player picker on /admin/settings: an
// organizer retiring a number needs to find a kid who left the team last
// season just as easily as someone still on it.
export async function GET(request, { params }) {
    const auth = await requireAnyPermission([
        "manage_teams", "team_view", "team_update",
        "manage_players", "player_view",
    ]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { id } = await params;

        const team = await Team.findById(id).select("name organization players").lean();
        if (!team) {
            return NextResponse.json({ success: false, error: "Team not found" }, { status: 404 });
        }
        if (hasRole(auth.user, "organizer")) {
            const orgId = await getOrgIdForOrganizer(auth.user);
            if (!orgId || String(team.organization) !== orgId) {
                return NextResponse.json({ success: false, error: "You cannot manage teams outside your organization" }, { status: 403 });
            }
        }

        const leagues = await League.find({ organization: team.organization }).select("_id").lean();
        const games = await Game.find({
            league: { $in: leagues.map((l) => l._id) },
            $or: [{ "teamA.name": team.name }, { "teamB.name": team.name }],
        }).select("teamA.name teamB.name").lean();

        const sideByGame = new Map();
        for (const g of games) {
            sideByGame.set(String(g._id), g.teamA.name === team.name ? "A" : "B");
        }

        const plays = await Play.find({ game: { $in: [...sideByGame.keys()] } })
            .select("type activeTeam game passerPlayer receiverPlayer rusherPlayer defenderPlayer flagPullPlayer")
            .lean();

        const playerIds = new Set((team.players || []).map((p) => String(p.player)));
        for (const play of plays) {
            const teamSide = sideByGame.get(String(play.game));
            if (!teamSide) continue;
            const fieldSides = getFieldSides(play.type, play.activeTeam);
            for (const [field, side] of Object.entries(fieldSides)) {
                if (side === teamSide && play[field]) playerIds.add(String(play[field]));
            }
        }

        const players = await Player.find({ _id: { $in: [...playerIds] } })
            .select("name")
            .sort({ name: 1 })
            .lean();

        return NextResponse.json({ success: true, data: players });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
