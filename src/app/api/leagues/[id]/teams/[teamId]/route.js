import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import League from "@/models/League";
import Team from "@/models/Team";
import User from "@/models/User";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";

async function assertOrganizerCanManage(authUser, organizationId) {
    if (!hasRole(authUser, "organizer")) return null;

    const currentUser = await User.findById(authUser.id).select("organization roleOrganizations").lean();
    const directOrg = currentUser?.organization ? String(currentUser.organization) : null;
    const roleOrgValues = Object.values(currentUser?.roleOrganizations || {})
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .map(String);
    const userOrgIds = [...new Set([directOrg, ...roleOrgValues].filter(Boolean))];

    if (!userOrgIds.includes(String(organizationId))) {
        return NextResponse.json(
            { success: false, error: "You can only manage teams for your assigned organization" },
            { status: 403 }
        );
    }
    return null;
}

// DELETE /api/leagues/[id]/teams/[teamId] — remove this league's membership
// from the team. The Team document itself (and every other league it
// belongs to) is untouched — only this one membership entry is dropped.
export async function DELETE(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_leagues", "league_update", "manage_teams", "team_update"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id, teamId } = await params;

        const league = await League.findById(id).select("organization").lean();
        if (!league) {
            return NextResponse.json({ success: false, error: "League not found" }, { status: 404 });
        }

        const forbidden = await assertOrganizerCanManage(auth.user, league.organization);
        if (forbidden) return forbidden;

        const team = await Team.findById(teamId);
        if (!team || String(team.organization) !== String(league.organization)) {
            return NextResponse.json({ success: false, error: "Team not found in this organization" }, { status: 404 });
        }

        team.leagues = team.leagues.filter((m) => String(m.league) !== String(id));
        await team.save();

        return NextResponse.json({ success: true, message: "Team removed from league" });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
