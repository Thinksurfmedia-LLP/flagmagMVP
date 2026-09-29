const test = require("node:test");
const assert = require("node:assert/strict");
const { escapeRegex, containsRegex, exactRegex, MAX_SEARCH_LENGTH } = require("../src/lib/searchRegex.js");

test("escapeRegex neutralises every regex metacharacter", () => {
    const raw = ".*+?^${}()|[]\\/";
    assert.equal(new RegExp(`^${escapeRegex(raw)}$`).test(raw), true);
});

test("containsRegex matches literally and case-insensitively", () => {
    const re = containsRegex("mike");
    assert.equal(re.test("Mikey Birk"), true);
    assert.equal(re.flags.includes("i"), true);
});

test("containsRegex treats metacharacters as plain text", () => {
    assert.equal(containsRegex("a.c").test("abc"), false);
    assert.equal(containsRegex("a.c").test("xa.cx"), true);
    assert.equal(containsRegex("(").test("Team (Thu)"), true); // used to throw "Invalid regular expression"
});

test("containsRegex defuses catastrophic-backtracking input (ReDoS)", () => {
    const evil = "(a+)+$";
    const started = Date.now();
    containsRegex(evil).test("a".repeat(5000) + "!");
    assert.ok(Date.now() - started < 50);
});

test("containsRegex returns null for empty / whitespace / non-string input", () => {
    for (const v of ["", "   ", null, undefined, 42, {}]) assert.equal(containsRegex(v), null);
});

test("search text is trimmed and capped", () => {
    assert.equal(containsRegex("  GOAT  ").source, "GOAT");
    assert.equal(containsRegex("x".repeat(MAX_SEARCH_LENGTH + 50)).source.length, MAX_SEARCH_LENGTH);
});

test("exactRegex anchors a whole-name, case-insensitive match", () => {
    const re = exactRegex("HMYG (Thu)");
    assert.equal(re.test("hmyg (thu)"), true);
    assert.equal(re.test("HMYG (Thu) STATS"), false);
    assert.equal(exactRegex(""), null);
});
