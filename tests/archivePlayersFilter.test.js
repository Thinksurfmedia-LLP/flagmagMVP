const test = require("node:test");
const assert = require("node:assert/strict");
const { buildArchiveFilter } = require("../src/lib/archivePlayersFilter");
const { STAND_IN_NAME_RE } = require("../src/lib/playerMergePlan");

test("archive filter: only unrostered imported players, scoped to the caller's orgs", () => {
    assert.deepEqual(buildArchiveFilter({ orgIds: ["o1"] }), {
        status: "free_agent", legacyArchive: true, organization: { $in: ["o1"] },
    });
    assert.deepEqual(buildArchiveFilter({ orgIds: null }), { status: "free_agent", legacyArchive: true });
});

test("archive filter: jersey-only vs named records, combined with a search", () => {
    const search = /mike/i;
    assert.deepEqual(buildArchiveFilter({ orgIds: null, kind: "jersey", searchRe: search }).$and, [
        { name: search }, { name: STAND_IN_NAME_RE },
    ]);
    assert.deepEqual(buildArchiveFilter({ orgIds: null, kind: "named" }).$and, [
        { name: { $not: STAND_IN_NAME_RE } },
    ]);
});

const { archiveSearchRegex } = require("../src/lib/archivePlayersFilter");

test("archive search: a trailing jersey number matches that number only", () => {
    const re = archiveSearchRegex("Darkside #5");
    assert.ok(re.test("Darkside #5 (Fall 2017)"));
    assert.ok(re.test("DARKSIDE #5 (Winter 2012)"));
    assert.ok(!re.test("Darkside #56 (Fall 2017)"));
    const re56 = archiveSearchRegex("  darkside #56 ");
    assert.ok(re56.test("Darkside #56 (Fall 2017)"));
    assert.ok(!re56.test("Darkside #560 (Fall 2017)"));
});

test("archive search: plain text is a case-insensitive contains match, metacharacters literal", () => {
    assert.ok(archiveSearchRegex("mike").test("Mike Zimmerman"));
    assert.ok(archiveSearchRegex("(a+)+$").test("x(a+)+$y"));
    assert.equal(archiveSearchRegex("   "), null);
    assert.equal(archiveSearchRegex(undefined), null);
});
