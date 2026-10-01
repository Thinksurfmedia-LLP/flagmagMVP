const test = require("node:test");
const assert = require("node:assert/strict");
const { CLIENT_HEADER, STATS_CLIENT, WEB_COOKIE_NAME, MOBILE_COOKIE_NAME, cookieNameForClient } = require("../src/lib/authClient.js");

test("stats app requests use only the mobile cookie", () => {
    assert.equal(cookieNameForClient(STATS_CLIENT), MOBILE_COOKIE_NAME);
});

test("requests without the client header use only the web cookie", () => {
    assert.equal(cookieNameForClient(null), WEB_COOKIE_NAME);
    assert.equal(cookieNameForClient(undefined), WEB_COOKIE_NAME);
    assert.equal(cookieNameForClient(""), WEB_COOKIE_NAME);
});

test("unknown client values fall back to the web cookie, never the mobile one", () => {
    assert.equal(cookieNameForClient("website"), WEB_COOKIE_NAME);
    assert.equal(cookieNameForClient("STATS-ish"), WEB_COOKIE_NAME);
});

test("header value matching is case-insensitive and trims whitespace", () => {
    assert.equal(cookieNameForClient(" Stats "), MOBILE_COOKIE_NAME);
});

test("cookie and header names match what both apps rely on", () => {
    assert.equal(WEB_COOKIE_NAME, "flagmag-token");
    assert.equal(MOBILE_COOKIE_NAME, "flagmag-mobile-token");
    assert.equal(CLIENT_HEADER, "x-flagmag-client");
    assert.equal(STATS_CLIENT, "stats");
});
