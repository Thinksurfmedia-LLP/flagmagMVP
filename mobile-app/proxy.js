import { NextResponse } from "next/server";

// Every /api call from the stats app is proxied to the main FlagMag backend
// (see the rewrites in next.config.mjs). Both apps share one browser cookie
// jar on the same hostname, so the backend can't tell from cookies alone
// which app is asking. Stamp every forwarded request here — one place, so no
// individual fetch can forget — and the backend then reads ONLY the stats
// session cookie (flagmag-mobile-token), never the website's. Must match
// CLIENT_HEADER / STATS_CLIENT in the backend's src/lib/authClient.js.
const CLIENT_HEADER = "x-flagmag-client";
const STATS_CLIENT = "stats";

export function proxy(request) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(CLIENT_HEADER, STATS_CLIENT);
    return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
    matcher: ["/api/:path*"],
};
