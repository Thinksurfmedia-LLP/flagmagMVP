import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import User from "@/models/User";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";
import { deletePlayer } from "@/lib/playerDeletion";
import { validateFreeAgentFields } from "@/lib/freeAgentValidation";

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

// PATCH free agent — edits this free agent's own profile (name/email/phone)
// on the Player doc only. The linked User login is deliberately left alone:
// one parent account can hold several kids' profiles, so editing one kid
// must not change the parent's sign-in email.
export async function PATCH(request, { params }) {
    const auth = await requireAnyPermission([
        "manage_players",
        "player_update",
    ]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { id } = await params;

        // Email stays optional on edit: some imported profiles never had one.
        const { values: value, errors } = validateFreeAgentFields(await request.json().catch(() => null));
        const firstError = Object.values(errors)[0];
        if (firstError) {
            return NextResponse.json({ success: false, error: firstError, fieldErrors: errors }, { status: 400 });
        }

        const player = await Player.findById(id).select("status organization").lean();
        if (!player) {
            return NextResponse.json({ success: false, error: "Free agent not found" }, { status: 404 });
        }
        if (player.status !== "free_agent") {
            return NextResponse.json({ success: false, error: "This player is no longer a free agent" }, { status: 400 });
        }

        if (!hasRole(auth.user, "admin")) {
            const orgIds = await getManagedOrgIds(auth.user);
            if (!player.organization || !orgIds.has(String(player.organization))) {
                return NextResponse.json({ success: false, error: "You can only manage free agents for your organization" }, { status: 403 });
            }
        }

        const updated = await Player.findByIdAndUpdate(id, { $set: value }, { new: true, runValidators: true })
            .populate("user", "name email phone")
            .populate("organization", "name slug")
            .lean();

        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        if (error.code === 11000) {
            return NextResponse.json(
                { success: false, error: "A free agent with this name already exists under the same account" },
                { status: 409 }
            );
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
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
