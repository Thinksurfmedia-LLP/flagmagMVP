import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

const PERMISSION_COMPATIBILITY = {
    manage_organizations: ["organization_view", "organization_create", "organization_update", "organization_delete"],
    manage_leagues: ["league_view", "league_create", "league_update", "league_delete"],
    manage_seasons: ["season_view", "season_create", "season_update", "season_delete"],
    manage_games: ["game_view", "game_create", "game_update", "game_delete"],
    manage_players: ["player_view", "player_create", "player_update", "player_delete"],
    manage_teams: ["team_view", "team_create", "team_update", "team_delete"],
    manage_users: ["user_view", "user_create", "user_update", "user_delete"],
};

/**
 * Check if the current request is from an authenticated user.
 * Returns the user payload or a 401 response.
 */
export async function requireAuth() {
    const user = await getCurrentUser();
    if (!user) {
        return {
            authorized: false,
            response: NextResponse.json(
                { success: false, error: "Authentication required" },
                { status: 401 }
            ),
        };
    }
    return { authorized: true, user };
}

/**
 * Check if the current request is from an admin or organizer.
 * Returns the user payload or a 403 response.
 */
export async function requireAdmin() {
    const auth = await requireAuth();
    if (!auth.authorized) return auth;

    if (auth.user.role !== "admin" && auth.user.role !== "organizer") {
        return {
            authorized: false,
            response: NextResponse.json(
                { success: false, error: "Admin or organizer access required" },
                { status: 403 }
            ),
        };
    }
    return auth;
}

/**
 * Check if the user has a specific permission or is an admin.
 * Admins bypass all permission checks.
 */
export async function requirePermission(permission) {
    const auth = await requireAuth();
    if (!auth.authorized) return auth;

    if (auth.user.role === "admin") return auth;
    if (permission === "view_dashboard") return auth;

    const perms = auth.user.permissions || [];
    const compatiblePerms = PERMISSION_COMPATIBILITY[permission] || [];
    const hasPermission = perms.includes(permission) || compatiblePerms.some((perm) => perms.includes(perm));

    if (!hasPermission) {
        return {
            authorized: false,
            response: NextResponse.json(
                { success: false, error: `Permission required: ${permission}` },
                { status: 403 }
            ),
        };
    }
    return auth;
}

/**
 * Check if the user has at least one of the provided permissions or is an admin.
 */
export async function requireAnyPermission(permissions = []) {
    const auth = await requireAuth();
    if (!auth.authorized) return auth;

    if (auth.user.role === "admin") return auth;

    const perms = auth.user.permissions || [];
    const hasAny = permissions.some((permission) => {
        if (perms.includes(permission)) return true;
        // Check if user has a parent permission that covers this one
        for (const [parent, children] of Object.entries(PERMISSION_COMPATIBILITY)) {
            if (children.includes(permission) && perms.includes(parent)) return true;
        }
        // Check if this permission is a parent that covers any child the user has
        const compatiblePerms = PERMISSION_COMPATIBILITY[permission] || [];
        if (compatiblePerms.some((p) => perms.includes(p))) return true;
        return false;
    });

    if (!hasAny) {
        return {
            authorized: false,
            response: NextResponse.json(
                { success: false, error: `One of these permissions is required: ${permissions.join(", ")}` },
                { status: 403 }
            ),
        };
    }

    return auth;
}
