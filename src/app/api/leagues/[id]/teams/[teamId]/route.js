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

// PUT /api/leagues/[id]/teams/[teamId] — update this membership's division
// and/or playoff seed number.
// Body: { division, seedNumber }
export async function PUT(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_leagues", "league_update", "manage_teams", "team_update"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id, teamId } = await params;
        const body = await request.json();

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

        const membership = team.leagues.find((m) => String(m.league) === String(id));
        if (!membership) {
            return NextResponse.json({ success: false, error: "Team is not assigned to this league" }, { status: 404 });
        }

        if ("division" in body) {
            membership.division = body.division?.trim() || "";
        }
        if ("seedNumber" in body) {
            const seedNumber = body.seedNumber !== null && body.seedNumber !== ""
                ? Number(body.seedNumber)
                : null;
            if (seedNumber !== null && !Number.isFinite(seedNumber)) {
                return NextResponse.json({ success: false, error: "Seed number must be a number" }, { status: 400 });
            }
            membership.seedNumber = seedNumber;
        }
        await team.save();

        return NextResponse.json({ success: true, data: { _id: team._id, name: team.name, logo: team.logo || "", division: membership.division, seedNumber: membership.seedNumber } });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE /api/leagues/[id]/teams/[teamId] — remove this league's membership
// from the team. The Team document itself (and every other league it
// belongs to) is untouched — only this one membership entry is dropped.
//
// `id` is allowed to point at a League that no longer exists: that's exactly
// the orphaned-membership case (League deleted with no cascade, dead ref left
// behind on the team — see the Denstar/XFlag audits). Org authorization then
// falls back to the team's own organization instead of the league's, since
// there's no league left to authorize against.
export async function DELETE(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_leagues", "league_update", "manage_teams", "team_update"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id, teamId } = await params;

        const league = await League.findById(id).select("organization").lean();

        const team = await Team.findById(teamId);
        if (!team) {
            return NextResponse.json({ success: false, error: "Team not found" }, { status: 404 });
        }

        const authOrgId = league ? league.organization : team.organization;
        if (league && String(team.organization) !== String(league.organization)) {
            return NextResponse.json({ success: false, error: "Team not found in this organization" }, { status: 404 });
        }

        const forbidden = await assertOrganizerCanManage(auth.user, authOrgId);
        if (forbidden) return forbidden;

        const membership = team.leagues.find((m) => String(m.league) === String(id));
        if (!membership) {
            return NextResponse.json({ success: false, error: "Team is not assigned to this league" }, { status: 404 });
        }

        team.leagues = team.leagues.filter((m) => String(m.league) !== String(id));
        await team.save();

        return NextResponse.json({ success: true, message: "Team removed from league" });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
