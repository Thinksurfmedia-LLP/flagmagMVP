import { getCurrentUser } from "@/lib/auth";
import { NextResponse } from "next/server";

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
