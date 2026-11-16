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
