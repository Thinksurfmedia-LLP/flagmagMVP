import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import User from "@/models/User";
import Team from "@/models/Team";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";

async function getOrgIdForOrganizer(authUser) {
    if (authUser.organization?.id) return authUser.organization.id;
    const userDoc =
        (await User.findById(authUser.id).select("organization").lean()) ||
        (await User.findOne({ email: authUser.email }).select("organization").lean());
    return userDoc?.organization ? String(userDoc.organization) : null;
}

// Recalculate User.role based on remaining Player docs
async function syncUserRole(userId) {
    const playerDocs = await Player.find({ user: userId }).select("status").lean();
    const hasPlayer = playerDocs.some((p) => p.status === "player");
    const hasFreeAgent = playerDocs.some((p) => p.status === "free_agent");

    const user = await User.findById(userId).select("role roles").lean();
    if (!user || ["admin", "organizer"].includes(user.role)) return;

    const newRole = hasPlayer ? "player" : hasFreeAgent ? "free_agent" : "viewer";
    const newRoles = user.roles.filter((r) => !["player", "free_agent", "viewer"].includes(r));
    if (hasPlayer) newRoles.push("player");
    if (hasFreeAgent) newRoles.push("free_agent");
    if (newRoles.length === 0) newRoles.push("viewer");

    await User.updateOne({ _id: userId }, { $set: { role: newRole, roles: newRoles } });
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

        // Remove from any teams (safety check)
        await Team.updateMany(
            { players: player._id },
            { $pull: { players: player._id } }
        );

        const userId = player.user;
        await Player.findByIdAndDelete(id);

        // Recalculate user role
        if (userId) {
            await syncUserRole(userId);
        }

        return NextResponse.json({ success: true, message: "Free agent removed" });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
