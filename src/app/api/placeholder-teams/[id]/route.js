import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Team from "@/models/Team";
import User from "@/models/User";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";

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

async function getPlaceholderForUser(id, user) {
    const team = await Team.findById(id);
    if (!team || !team.isPlaceholder) return null;

    if (hasRole(user, "organizer") && !hasRole(user, "admin")) {
        const organizerOrgId = await getOrgIdForOrganizer(user);
        if (!organizerOrgId || String(team.organization) !== organizerOrgId) {
            return "forbidden";
        }
    }

    return team;
}

// PUT rename a placeholder / change its image. Name and logo only - a
// placeholder has no roster, coach, or league membership to edit.
export async function PUT(request, { params }) {
    const auth = await requireAnyPermission(["manage_leagues", "league_update", "manage_teams", "team_update"]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { id } = await params;
        const body = await request.json();

        const team = await getPlaceholderForUser(id, auth.user);
        if (!team) {
            return NextResponse.json({ success: false, error: "Placeholder team not found" }, { status: 404 });
        }
        if (team === "forbidden") {
            return NextResponse.json(
                { success: false, error: "You cannot manage placeholders outside your organization" },
                { status: 403 }
            );
        }

        if (body.name !== undefined) {
            if (!body.name.trim()) {
                return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
            }
            team.name = body.name.trim();
        }
        if (body.logo !== undefined) team.logo = body.logo || "";

        await team.save();

        return NextResponse.json({ success: true, data: team });
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

// DELETE remove a placeholder entirely.
export async function DELETE(request, { params }) {
    const auth = await requireAnyPermission(["manage_leagues", "league_update", "manage_teams", "team_delete"]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { id } = await params;

        const team = await getPlaceholderForUser(id, auth.user);
        if (!team) {
            return NextResponse.json({ success: false, error: "Placeholder team not found" }, { status: 404 });
        }
        if (team === "forbidden") {
            return NextResponse.json(
                { success: false, error: "You cannot manage placeholders outside your organization" },
                { status: 403 }
            );
        }

        await Team.findByIdAndDelete(id);

        return NextResponse.json({ success: true, message: "Placeholder deleted" });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
