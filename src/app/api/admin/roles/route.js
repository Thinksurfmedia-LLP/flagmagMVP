import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Role, { seedDefaultRoles } from "@/models/Role";
import { requireAdmin } from "@/lib/apiAuth";

function expandFullAccessPermissions(rawPermissions = []) {
    const selected = new Set(rawPermissions);
    const groups = [
        ["manage_organizations", ["organization_view", "organization_create", "organization_update", "organization_delete"]],
        ["manage_seasons", ["season_view", "season_create", "season_update", "season_delete"]],
        ["manage_games", ["game_view", "game_create", "game_update", "game_delete"]],
        ["manage_players", ["player_view", "player_create", "player_update", "player_delete"]],
        ["manage_teams", ["team_view", "team_create", "team_update", "team_delete"]],
        ["manage_users", ["user_view", "user_create", "user_update", "user_delete"]],
    ];

    groups.forEach(([fullPerm, scopedPerms]) => {
        if (selected.has(fullPerm)) {
            scopedPerms.forEach((perm) => selected.add(perm));
        }
    });

    return Array.from(selected);
}

export async function GET() {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        await seedDefaultRoles();
        const roles = await Role.find({}).sort({ isSystem: -1, name: 1 }).lean();
        return NextResponse.json({ success: true, data: roles });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    if (auth.user.role !== "admin") {
        return NextResponse.json(
            { success: false, error: "Only admins can create roles" },
            { status: 403 }
        );
    }

    try {
        await dbConnect();
        const { name, permissions } = await request.json();

        if (!name || !name.trim()) {
            return NextResponse.json(
                { success: false, error: "Role name is required" },
                { status: 400 }
            );
        }

        const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

        const existing = await Role.findOne({ $or: [{ slug }, { name: name.trim() }] });
        if (existing) {
            return NextResponse.json(
                { success: false, error: "A role with this name already exists" },
                { status: 409 }
            );
        }

        const role = await Role.create({
            name: name.trim(),
            slug,
            permissions: Array.from(new Set([...(expandFullAccessPermissions(permissions || [])), "view_dashboard"])),
            isSystem: false,
        });

        return NextResponse.json({ success: true, data: role }, { status: 201 });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
