import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Role from "@/models/Role";
import User from "@/models/User";
import { requireAdmin } from "@/lib/apiAuth";

function expandFullAccessPermissions(rawPermissions = []) {
    const selected = new Set(rawPermissions);
    const groups = [
        ["manage_organizations", ["organization_view", "organization_create", "organization_update", "organization_delete"]],
        ["manage_seasons", ["season_view", "season_create", "season_update", "season_delete"]],
        ["manage_games", ["game_view", "game_create", "game_update", "game_delete"]],
        ["manage_players", ["player_view", "player_create", "player_update", "player_delete"]],
        ["manage_users", ["user_view", "user_create", "user_update", "user_delete"]],
    ];

    groups.forEach(([fullPerm, scopedPerms]) => {
        if (selected.has(fullPerm)) {
            scopedPerms.forEach((perm) => selected.add(perm));
        }
    });

    return Array.from(selected);
}

export async function PUT(request, { params }) {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    if (auth.user.role !== "admin") {
        return NextResponse.json(
            { success: false, error: "Only admins can edit roles" },
            { status: 403 }
        );
    }

    try {
        await dbConnect();
        const { id } = await params;
        const { name, permissions } = await request.json();

        const role = await Role.findById(id);
        if (!role) {
            return NextResponse.json(
                { success: false, error: "Role not found" },
                { status: 404 }
            );
        }

        // System roles can have permissions updated but not renamed
        if (role.isSystem && name && name.trim().toLowerCase() !== role.name.toLowerCase()) {
            return NextResponse.json(
                { success: false, error: "System roles cannot be renamed" },
                { status: 400 }
            );
        }

        if (name && !role.isSystem) {
            role.name = name.trim();
            role.slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
        }
        if (permissions !== undefined) {
            role.permissions = Array.from(new Set([...(expandFullAccessPermissions(permissions || [])), "view_dashboard"]));
        }

        await role.save();
        return NextResponse.json({ success: true, data: role });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

export async function DELETE(request, { params }) {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    if (auth.user.role !== "admin") {
        return NextResponse.json(
            { success: false, error: "Only admins can delete roles" },
            { status: 403 }
        );
    }

    try {
        await dbConnect();
        const { id } = await params;

        const role = await Role.findById(id);
        if (!role) {
            return NextResponse.json(
                { success: false, error: "Role not found" },
                { status: 404 }
            );
        }

        if (role.isSystem) {
            return NextResponse.json(
                { success: false, error: "System roles cannot be deleted" },
                { status: 400 }
            );
        }

        // Check if any users have this role
        const userCount = await User.countDocuments({ role: role.slug });
        if (userCount > 0) {
            return NextResponse.json(
                { success: false, error: `Cannot delete role — ${userCount} user(s) are assigned to it` },
                { status: 400 }
            );
        }

        await Role.findByIdAndDelete(id);
        return NextResponse.json({ success: true, message: "Role deleted" });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
