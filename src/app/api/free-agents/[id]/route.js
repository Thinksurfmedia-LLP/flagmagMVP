import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import User from "@/models/User";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";
import { deletePlayer } from "@/lib/playerDeletion";

async function getOrgIdForOrganizer(authUser) {
    if (authUser.organization?.id) return authUser.organization.id;
    const userDoc =
        (await User.findById(authUser.id).select("organization roleOrganizations").lean()) ||
        (await User.findOne({ email: authUser.email }).select("organization roleOrganizations").lean());

    if (userDoc?.roleOrganizations?.organizer) {
        const orgs = userDoc.roleOrganizations.organizer;
        if (Array.isArray(orgs) && orgs.length > 0) return String(orgs[0]);
        if (typeof orgs === "string") return String(orgs);
    }

    return userDoc?.organization ? String(userDoc.organization) : null;
}

// DELETE free agent (remove from org)
export async function DELETE(request, { params }) {
    const auth = await requireAnyPermission([
        "manage_players",
        "player_delete",
    ]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { id } = await params;

        const player = await Player.findById(id);
        if (!player) {
            return NextResponse.json({ success: false, error: "Free agent not found" }, { status: 404 });
        }

        if (player.status !== "free_agent") {
            return NextResponse.json(
                { success: false, error: "Cannot remove a player who is assigned to a team. Remove them from the team first." },
                { status: 400 }
            );
        }

        if (hasRole(auth.user, "organizer")) {
            const orgId = await getOrgIdForOrganizer(auth.user);
            if (!orgId || String(player.organization) !== orgId) {
                return NextResponse.json({ success: false, error: "You can only manage free agents for your organization" }, { status: 403 });
            }
        }

        // Shared with DELETE /api/players/[id]: clears any leftover roster
        // entries (the old `$pull: { players: id }` here used the pre-subdoc
        // roster shape and never matched), syncs the user's role, and refuses
        // if this free agent has recorded plays/awards from past teams.
        const result = await deletePlayer(id);
        if (!result.ok) {
            return NextResponse.json({ success: false, error: result.error }, { status: result.status });
        }

        return NextResponse.json({ success: true, message: "Free agent removed" });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
