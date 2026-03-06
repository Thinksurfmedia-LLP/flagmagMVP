import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || "fallback-secret-do-not-use-in-production"
);

const COOKIE_NAME = "flagmag-token";
const TOKEN_EXPIRY = "7d";

/**
 * Create a signed JWT for the given user payload.
 */
export async function signToken(payload) {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(TOKEN_EXPIRY)
        .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token.
 * Returns the payload or null if invalid/expired.
 */
export async function verifyToken(token) {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload;
    } catch {
        return null;
    }
}

/**
 * Set the auth cookie with the JWT token.
 */
export async function setAuthCookie(token) {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
    });
}

/**
 * Get the current user from the auth cookie.
 * Returns the user payload or null if not authenticated.
 */
export async function getCurrentUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
}

/**
 * Clear the auth cookie (logout).
 */
export async function clearAuthCookie() {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}
