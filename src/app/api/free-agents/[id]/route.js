import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import User from "@/models/User";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";
import { deletePlayer } from "@/lib/playerDeletion";

// Every organization this user may manage, from the live user record (the
// JWT's org can be stale until next login, and organizers can have several).
async function getManagedOrgIds(authUser) {
    const userDoc =
        (await User.findById(authUser.id).select("organization roleOrganizations").lean()) ||
        (await User.findOne({ email: authUser.email }).select("organization roleOrganizations").lean());

    const orgIds = new Set();
    if (userDoc?.organization) orgIds.add(String(userDoc.organization));
    const organizerOrgs = userDoc?.roleOrganizations?.organizer;
    [].concat(organizerOrgs || []).filter(Boolean).forEach((id) => orgIds.add(String(id)));
    if (!userDoc && authUser.organization?.id) orgIds.add(String(authUser.organization.id));
    return orgIds;
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

        // Everyone except admins (organizers, custom roles holding
        // player_delete) is limited to free agents in their own organizations.
        if (!hasRole(auth.user, "admin")) {
            const orgIds = await getManagedOrgIds(auth.user);
            if (!player.organization || !orgIds.has(String(player.organization))) {
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
