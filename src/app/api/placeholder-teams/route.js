import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Team from "@/models/Team";
import User from "@/models/User";
import { requireAnyPermission } from "@/lib/apiAuth";
import { ensurePlaceholderTeams } from "@/lib/placeholderTeams";

async function getOrgIdForOrganizer(authUser) {
    if (authUser.organization?.id) return authUser.organization.id;
    const userDoc = await User.findById(authUser.id).select("organization roleOrganizations").lean();

    if (userDoc?.roleOrganizations?.organizer) {
        const orgs = userDoc.roleOrganizations.organizer;
        if (Array.isArray(orgs) && orgs.length > 0) return String(orgs[0]);
        if (typeof orgs === "string") return String(orgs);
    }

    return userDoc?.organization ? String(userDoc.organization) : null;
}

// GET all placeholder teams (TBD, Winner, Losers, bracket slots, etc.) for
// one organization - the bracket-slot "teams" schedules use when the real
// opponent isn't decided yet.
export async function GET(request) {
    const auth = await requireAnyPermission(["manage_leagues", "league_view", "manage_teams", "team_view"]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const allRoles = auth.user.roles?.length ? auth.user.roles : [auth.user.role];
        const isOrganizer = allRoles.includes("organizer") && !allRoles.includes("admin");

        const organization = isOrganizer
            ? await getOrgIdForOrganizer(auth.user)
            : searchParams.get("organization");

        if (!organization) {
            return NextResponse.json({ success: false, error: "Organization is required" }, { status: 400 });
        }

        await ensurePlaceholderTeams(organization);

        const teams = await Team.find({ organization, isPlaceholder: true })
            .sort({ name: 1 })
            .lean();

        return NextResponse.json({ success: true, data: teams });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST create a new placeholder team (e.g. a custom bracket slot beyond the
// default TBD/Winner/Losers/D1-D4 set).
export async function POST(request) {
    const auth = await requireAnyPermission(["manage_leagues", "league_update", "manage_teams", "team_create"]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const body = await request.json();

        if (!body.name?.trim()) {
            return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
        }

        const allRoles = auth.user.roles?.length ? auth.user.roles : [auth.user.role];
        const isOrganizer = allRoles.includes("organizer") && !allRoles.includes("admin");
        const organizationId = isOrganizer
            ? await getOrgIdForOrganizer(auth.user)
            : body.organization;

        if (!organizationId) {
            return NextResponse.json({ success: false, error: "Organization is required" }, { status: 400 });
        }

        const team = await Team.create({
            name: body.name.trim(),
            logo: body.logo || "",
            organization: organizationId,
            isPlaceholder: true,
        });

        return NextResponse.json({ success: true, data: team }, { status: 201 });
    } catch (error) {
        if (error.code === 11000) {
            return NextResponse.json(
                { success: false, error: "A team with that name already exists in this organization" },
                { status: 409 }
            );
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
