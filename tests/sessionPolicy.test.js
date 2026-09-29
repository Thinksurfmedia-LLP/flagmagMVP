const test = require("node:test");
const assert = require("node:assert/strict");
const { lastScheduledLogout, readPolicy } = require("../src/lib/sessionPolicy.js");

const LA = { timeZone: "America/Los_Angeles", hour: 0 };
const iso = (d) => d.toISOString();

test("returns the most recent midnight Pacific (PDT, UTC-7)", () => {
    // Sun 27 Sep 2026, 7:10 PM PDT = 28 Sep 02:10 UTC -> midnight was 27 Sep 07:00 UTC
    assert.equal(iso(lastScheduledLogout(new Date("2026-09-28T02:10:00Z"), LA)), "2026-09-27T07:00:00.000Z");
});

test("just after midnight, the cutoff is that same midnight", () => {
    assert.equal(iso(lastScheduledLogout(new Date("2026-09-28T07:00:30Z"), LA)), "2026-09-28T07:00:00.000Z");
});

test("just before midnight, the cutoff is still the previous midnight", () => {
    assert.equal(iso(lastScheduledLogout(new Date("2026-09-28T06:59:59Z"), LA)), "2026-09-27T07:00:00.000Z");
});

test("uses PST (UTC-8) in winter", () => {
    assert.equal(iso(lastScheduledLogout(new Date("2026-12-15T20:00:00Z"), LA)), "2026-12-15T08:00:00.000Z");
});

test("handles the day clocks fall back (1 Nov 2026) and spring forward (8 Mar 2026)", () => {
    // Midnight 1 Nov is still PDT (fall back happens at 2am)
    assert.equal(iso(lastScheduledLogout(new Date("2026-11-01T18:00:00Z"), LA)), "2026-11-01T07:00:00.000Z");
    // Midnight 8 Mar is still PST (spring forward happens at 2am)
    assert.equal(iso(lastScheduledLogout(new Date("2026-03-08T18:00:00Z"), LA)), "2026-03-08T08:00:00.000Z");
});

test("supports a non-midnight hour and another timezone", () => {
    const cfg = { timeZone: "America/New_York", hour: 3 };
    // 15 Jan 2026 10:00 UTC = 5:00 AM EST -> 3:00 AM EST that day = 08:00 UTC
    assert.equal(iso(lastScheduledLogout(new Date("2026-01-15T10:00:00Z"), cfg)), "2026-01-15T08:00:00.000Z");
});

test("readPolicy: defaults to midnight Pacific, can be disabled, rejects bad values", () => {
    assert.deepEqual(readPolicy({}), { enabled: true, timeZone: "America/Los_Angeles", hour: 0 });
    assert.equal(readPolicy({ SESSION_DAILY_LOGOUT: "off" }).enabled, false);
    assert.equal(readPolicy({ SESSION_DAILY_LOGOUT_HOUR: "4" }).hour, 4);
    assert.equal(readPolicy({ SESSION_DAILY_LOGOUT_HOUR: "25" }).hour, 0);
    assert.equal(readPolicy({ SESSION_DAILY_LOGOUT_TZ: "Not/AZone" }).timeZone, "America/Los_Angeles");
});
