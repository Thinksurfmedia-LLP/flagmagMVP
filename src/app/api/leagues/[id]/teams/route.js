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

// GET /api/leagues/[id]/teams — teams currently assigned to this league
export async function GET(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_leagues", "league_view", "league_update", "manage_teams", "team_view"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;

        const league = await League.findById(id).select("organization").lean();
        if (!league) {
            return NextResponse.json({ success: false, error: "League not found" }, { status: 404 });
        }

        const teams = await Team.find({ organization: league.organization, "leagues.league": id })
            .select("name logo leagues")
            .sort({ name: 1 })
            .lean();

        const data = teams.map((t) => ({
            _id: t._id,
            name: t.name,
            logo: t.logo || "",
            division: (t.leagues || []).find((m) => String(m.league) === String(id))?.division || "",
        }));

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST /api/leagues/[id]/teams — assign an existing team, or create + assign a new one
// Body: { teamId, division } to assign an existing team
//    or { name, logo, division } to create a new team and assign it
export async function POST(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_leagues", "league_update", "manage_teams", "team_update"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const body = await request.json();
        const division = body.division?.trim() || "";

        const league = await League.findById(id).select("organization").lean();
        if (!league) {
            return NextResponse.json({ success: false, error: "League not found" }, { status: 404 });
        }

        const forbidden = await assertOrganizerCanManage(auth.user, league.organization);
        if (forbidden) return forbidden;

        let team;

        if (body.teamId) {
            team = await Team.findById(body.teamId);
            if (!team) {
                return NextResponse.json({ success: false, error: "Team not found" }, { status: 404 });
            }
            if (String(team.organization) !== String(league.organization)) {
                return NextResponse.json({ success: false, error: "Team belongs to a different organization" }, { status: 400 });
            }
        } else {
            const name = body.name?.trim();
            if (!name) {
                return NextResponse.json({ success: false, error: "teamId or name is required" }, { status: 400 });
            }

            // Preserve one persistent identity per team name within the org —
            // never silently create a duplicate.
            const existing = await Team.findOne({
                organization: league.organization,
                name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
            });
            if (existing) {
                return NextResponse.json(
                    { success: false, error: `A team named "${name}" already exists in this organization — assign it instead of creating a new one.` },
                    { status: 409 }
                );
            }

            team = await Team.create({
                name,
                logo: body.logo || "",
                organization: league.organization,
                leagues: [],
            });
        }

        const alreadyAssigned = team.leagues.some((m) => String(m.league) === String(id));
        if (alreadyAssigned) {
            return NextResponse.json({ success: false, error: "Team is already assigned to this league" }, { status: 409 });
        }

        team.leagues.push({ league: id, division, joinedAt: new Date() });
        await team.save();

        return NextResponse.json(
            { success: true, data: { _id: team._id, name: team.name, logo: team.logo || "", division } },
            { status: 201 }
        );
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
