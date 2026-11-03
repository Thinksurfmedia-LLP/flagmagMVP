const test = require("node:test");
const assert = require("node:assert/strict");
const {
    UNNAMED_USER_OFFSET,
    parseSgsPlayerName,
    formatSgsTime,
    seasonSlug,
    unnamedPlayerName,
} = require("../src/lib/sgsImport.js");

test("parseSgsPlayerName flips 'Last, First' into first/last", () => {
    assert.deepEqual(parseSgsPlayerName("Lewis, Michael"), { first: "Michael", last: "Lewis" });
    assert.deepEqual(parseSgsPlayerName("Walsh,Christopher"), { first: "Christopher", last: "Walsh" });
    assert.deepEqual(parseSgsPlayerName("  Vasconcellos,   Josh "), { first: "Josh", last: "Vasconcellos" });
    assert.deepEqual(parseSgsPlayerName("P,Eddie"), { first: "Eddie", last: "P" });
});

test("parseSgsPlayerName falls back to 'First Last' when there is no comma", () => {
    assert.deepEqual(parseSgsPlayerName("Mike Zimmerman"), { first: "Mike", last: "Zimmerman" });
    assert.deepEqual(parseSgsPlayerName("Cher"), { first: "Cher", last: "" });
    assert.deepEqual(parseSgsPlayerName(""), { first: "", last: "" });
});

test("formatSgsTime zero-pads the hour and keeps it as written", () => {
    assert.equal(formatSgsTime("900"), "09:00");
    assert.equal(formatSgsTime("1000"), "10:00");
    assert.equal(formatSgsTime("100"), "01:00");
    assert.equal(formatSgsTime("0800"), "08:00");
    assert.equal(formatSgsTime("1230"), "12:30");
});

test("formatSgsTime returns empty for missing times", () => {
    assert.equal(formatSgsTime("0"), "");
    assert.equal(formatSgsTime(""), "");
    assert.equal(formatSgsTime(null), "");
});

test("seasonSlug matches the slugs used for later seasons", () => {
    assert.equal(seasonSlug("Summer 2008"), "summer-2008");
    assert.equal(seasonSlug("Winter 2009"), "winter-2009");
});

test("unnamedPlayerName identifies the slot by team, jersey and season", () => {
    assert.equal(unnamedPlayerName("Bandidos", 12, "Summer 2009"), "Bandidos #12 (Summer 2009)");
    assert.equal(unnamedPlayerName("Bandidos", 0, "Summer 2009"), "Bandidos #0 (Summer 2009)");
    assert.equal(unnamedPlayerName("", null, "Fall 2010"), "Unknown team #? (Fall 2010)");
});

test("unnamed user ids sit above every real SGS player id", () => {
    assert.ok(UNNAMED_USER_OFFSET > 4944);
});
