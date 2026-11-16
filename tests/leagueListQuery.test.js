const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeSeasonParam } = require("../src/lib/leagueListQuery.js");

test("keeps the literal 'default'", () => {
    assert.equal(normalizeSeasonParam("default"), "default");
});

test("accepts a 24-hex season id, lowercased so cache keys don't split on case", () => {
    assert.equal(normalizeSeasonParam("6AE8DE37E6896BB733F10D4C"), "6ae8de37e6896bb733f10d4c");
    assert.equal(normalizeSeasonParam("6ae8de37e6896bb733f10d4c"), "6ae8de37e6896bb733f10d4c");
});

test("ignores absent or non-id values (route then returns every league)", () => {
    for (const value of [null, undefined, "", "Default", "bogus", "aaaaaaaaaaaa", "6ae8de37e6896bb733f10d4", "6ae8de37e6896bb733f10d4cz", "6ae8de37e6896bb733f10d4c "]) {
        assert.equal(normalizeSeasonParam(value), null, String(value));
    }
});
