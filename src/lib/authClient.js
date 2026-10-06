// Which app a request came from decides which session cookie it may use.
//
// The website (localhost:3000) and the stats app (localhost:3001) share one
// browser cookie jar — cookies are scoped by hostname, not port — and every
// stats-app /api call is proxied here. So the cookie alone can't say who is
// asking. The stats app's proxy.js stamps every request it forwards with
// CLIENT_HEADER: STATS_CLIENT; everything else is the website. Each side
// reads ONLY its own cookie, never the other's, so account A on the website
// and account B on the stats app stay fully independent.
//
// Not a security boundary: the header only picks which cookie to read, and
// the request still needs that cookie's valid token.

const CLIENT_HEADER = "x-flagmag-client";
const STATS_CLIENT = "stats";
const WEB_COOKIE_NAME = "flagmag-token";
const MOBILE_COOKIE_NAME = "flagmag-mobile-token";

function cookieNameForClient(clientHeaderValue) {
    const client = String(clientHeaderValue || "").trim().toLowerCase();
    return client === STATS_CLIENT ? MOBILE_COOKIE_NAME : WEB_COOKIE_NAME;
}

// Native stats apps can't rely on a browser cookie jar, so they may present
// the same session JWT as `Authorization: Bearer <token>` instead. A bearer
// token is explicit, so it needs no client header to pick a cookie.
function bearerTokenFromHeader(authorizationValue) {
    const match = /^Bearer\s+(\S+)\s*$/i.exec(String(authorizationValue || ""));
    return match ? match[1] : null;
}

module.exports = { CLIENT_HEADER, STATS_CLIENT, WEB_COOKIE_NAME, MOBILE_COOKIE_NAME, cookieNameForClient, bearerTokenFromHeader };
