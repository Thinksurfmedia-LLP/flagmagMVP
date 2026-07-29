import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

if (!process.env.JWT_SECRET) {
    // A missing env var here means different server instances (or a
    // redeploy that finally sets it) can end up signing/verifying with
    // different secrets, which invalidates everyone's session with no
    // warning. Surface it loudly in logs instead of quietly limping along.
    console.error(
        "JWT_SECRET is not set — falling back to an insecure shared secret. " +
        "Set JWT_SECRET in the environment to avoid unpredictable session invalidation."
    );
}
const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || "fallback-secret-do-not-use-in-production"
);

const COOKIE_NAME = "flagmag-token";
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
const TOKEN_EXPIRY = `${TOKEN_MAX_AGE_SECONDS}s`;
// Once a token is more than half-way to expiry, reissue it on the next
// authenticated request — a sliding window so an actively-used session
// never hits the hard cutoff mid-task. Only real inactivity (7+ days of
// nobody touching the site) lets it actually expire.
const REFRESH_THRESHOLD_SECONDS = TOKEN_MAX_AGE_SECONDS / 2;

function cookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: TOKEN_MAX_AGE_SECONDS,
        path: "/",
    };
}

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
    cookieStore.set(COOKIE_NAME, token, cookieOptions());
}

/**
 * Get the current user from the auth cookie.
 * Returns the user payload or null if not authenticated.
 *
 * Only ever called from Route Handlers / Server Actions (never Server
 * Components), so it's safe to write the refreshed cookie here directly.
 */
export async function getCurrentUser() {
    const cookieStore = await cookies();
    const webToken = cookieStore.get(COOKIE_NAME)?.value;
    const token = webToken || cookieStore.get("flagmag-mobile-token")?.value;
    if (!token) return null;

    const payload = await verifyToken(token);
    if (!payload) return null;

    // Don't slide the mobile-token cookie here — it's managed by its own
    // login/logout routes and isn't ours to rewrite.
    if (webToken) {
        try {
            const issuedAt = typeof payload.iat === "number" ? payload.iat : 0;
            const ageSeconds = Date.now() / 1000 - issuedAt;
            if (issuedAt && ageSeconds > REFRESH_THRESHOLD_SECONDS) {
                const { iat, exp, ...rest } = payload;
                const freshToken = await signToken(rest);
                cookieStore.set(COOKIE_NAME, freshToken, cookieOptions());
            }
        } catch {
            // Best-effort refresh — never fail auth just because the
            // sliding-window renewal itself hit an error.
        }
    }

    return payload;
}

/**
 * Clear the auth cookie (logout).
 */
export async function clearAuthCookie() {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}
