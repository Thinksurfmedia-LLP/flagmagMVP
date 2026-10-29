import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Team from "@/models/Team";
import Activity from "@/models/Activity";
import Notification from "@/models/Notification";
import Payment from "@/models/Payment";
import Player from "@/models/Player";
import { requireAuth } from "@/lib/apiAuth";
import { forgetUserSessionInfo, MOBILE_COOKIE_NAME } from "@/lib/auth";
import { WEB_COOKIE_NAME } from "@/lib/authClient";
import { inTransaction } from "@/lib/teamJerseyGuard";
import { deleteAccount } from "@/lib/accountDeletion";
import { checkRateLimit } from "@/lib/rateLimit";

// The password re-check would otherwise let a stolen session guess the
// password freely. Keyed per user, not per IP.
const RATE_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };

// Permanently deletes the signed-in user's account (stats app + website).
// Lives under /api/auth/ so the stats app's request helper doesn't treat a
// wrong-password 401 as an expired session and bounce to the login screen.
export async function POST(request) {
    try {
        const auth = await requireAuth();
        if (!auth.authorized) return auth.response;

        const { allowed, retryAfterSeconds } = checkRateLimit(`delete-account:${auth.user.id}`, RATE_LIMIT);
        if (!allowed) {
            return NextResponse.json(
                { success: false, error: "Too many attempts. Please wait a few minutes and try again." },
                { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
            );
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
        }

        await dbConnect();
        const result = await deleteAccount(
            { userId: auth.user.id, password: body?.password },
            {
                User, Team, Activity, Notification, Payment, Player,
                comparePassword: (plain, hash) => bcrypt.compare(plain, hash),
                inTransaction,
            }
        );
        if (!result.ok) {
            return NextResponse.json({ success: false, error: result.error }, { status: result.status });
        }

        // Other devices are signed out by the auth check itself (the user no
        // longer exists); drop the cached lookup so that applies immediately.
        forgetUserSessionInfo(auth.user.id);

        const res = NextResponse.json({ success: true, message: "Account deleted" });
        res.cookies.delete(MOBILE_COOKIE_NAME);
        res.cookies.delete(WEB_COOKIE_NAME);
        return res;
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
