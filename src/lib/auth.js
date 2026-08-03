import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import User from "@/models/User";

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

// Per-org cutoff covering every member of that org (organizer, statistician,
// whoever) on either platform, cached briefly so this doesn't hit the DB on
// every single request just to check it.
const ORG_CUTOFF_CACHE_MS = 5000;
const orgCutoffCache = new Map();

async function getOrgSessionsCutoff(orgId) {
    const now = Date.now();
    const cached = orgCutoffCache.get(orgId);
    if (cached && now - cached.checkedAt < ORG_CUTOFF_CACHE_MS) {
        return cached.cutoff;
    }
    await dbConnect();
    const org = await Organization.findById(orgId).select("sessionsInvalidatedAt").lean();
    const cutoff = org?.sessionsInvalidatedAt || null;
    orgCutoffCache.set(orgId, { checkedAt: now, cutoff });
    return cutoff;
}

/**
 * Call right after writing a new sessionsInvalidatedAt so the cutoff takes
 * effect on the very next request instead of waiting out the cache TTL.
 */
export function invalidateOrgCutoffCache(orgId) {
    orgCutoffCache.delete(String(orgId));
}

// The JWT's own `organization` field only reflects User.organization (the
// primary field) as it was at login time — many users (e.g. anyone linked
// via roleOrganizations only, with no primary organization set) have their
// real org membership living elsewhere entirely. Trusting the token alone
// silently exempted those users from every org-scoped cutoff. Look up their
// actual live links instead; cached briefly since role assignments rarely
// change request-to-request.
const USER_ORGS_CACHE_MS = 5000;
const userOrgsCache = new Map();

async function getUserOrgIds(userId) {
    const now = Date.now();
    const cached = userOrgsCache.get(userId);
    if (cached && now - cached.checkedAt < USER_ORGS_CACHE_MS) {
        return cached.orgIds;
    }
    await dbConnect();
    const userDoc = await User.findById(userId).select("organization roleOrganizations").lean();
    const orgIds = new Set();
    if (userDoc?.organization) orgIds.add(String(userDoc.organization));
    Object.values(userDoc?.roleOrganizations || {})
        .flatMap((v) => (Array.isArray(v) ? v : [v]))
        .filter(Boolean)
        .forEach((id) => orgIds.add(String(id)));
    const result = [...orgIds];
    userOrgsCache.set(userId, { checkedAt: now, orgIds: result });
    return result;
}

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
 * Get the current user plus *why* auth failed, when it did.
 * `invalidated: true` means the cookie was otherwise valid but got cut off
 * by a force-logout — distinct from never having logged in at all, so
 * callers can react (e.g. clear client cache) without looping on visitors
 * who were never authenticated.
 *
 * Only ever called from Route Handlers / Server Actions (never Server
 * Components), so it's safe to write the refreshed cookie here directly.
 */
export async function getAuthState() {
    const cookieStore = await cookies();
    const webToken = cookieStore.get(COOKIE_NAME)?.value;
    const token = webToken || cookieStore.get("flagmag-mobile-token")?.value;
    if (!token) return { user: null, invalidated: false };

    const payload = await verifyToken(token);
    if (!payload) return { user: null, invalidated: false };

    if (payload.id) {
        const orgIds = await getUserOrgIds(payload.id);
        for (const orgId of orgIds) {
            const cutoff = await getOrgSessionsCutoff(orgId);
            if (cutoff && payload.iat * 1000 < new Date(cutoff).getTime()) {
                return { user: null, invalidated: true };
            }
        }
    }

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

    return { user: payload, invalidated: false };
}

/**
 * Get the current user from the auth cookie.
 * Returns the user payload or null if not authenticated.
 */
export async function getCurrentUser() {
    const { user } = await getAuthState();
    return user;
}

/**
 * Mobile-only variant of getAuthState — checks ONLY flagmag-mobile-token,
 * never falling back to the web cookie.
 *
 * Cookies aren't port-scoped: localhost:3000 (admin) and localhost:3001
 * (stats app) share the same browser cookie jar, by hostname alone. The two
 * apps use differently-named cookies specifically so two different accounts
 * can be logged in at once in the same browser — but getAuthState()'s web-
 * first fallback defeats that the moment both cookies are present: whoever
 * is logged into the admin dashboard silently wins identity checks in the
 * stats app too, no matter which account just logged in there. Use this for
 * anything that must answer "who is logged into the stats app" specifically.
 */
export async function getMobileAuthState() {
    const cookieStore = await cookies();
    const token = cookieStore.get("flagmag-mobile-token")?.value;
    if (!token) return { user: null, invalidated: false };

    const payload = await verifyToken(token);
    if (!payload) return { user: null, invalidated: false };

    if (payload.id) {
        const orgIds = await getUserOrgIds(payload.id);
        for (const orgId of orgIds) {
            const cutoff = await getOrgSessionsCutoff(orgId);
            if (cutoff && payload.iat * 1000 < new Date(cutoff).getTime()) {
                return { user: null, invalidated: true };
            }
        }
    }

    return { user: payload, invalidated: false };
}

/**
 * Clear the auth cookie (logout).
 */
export async function clearAuthCookie() {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}
