const test = require("node:test");
const assert = require("node:assert/strict");
const { parseMergeRequest, findSharedGames, mergeBlockers, MAX_MERGE_SOURCES } = require("../src/lib/playerMergePlan");

const id = (n) => String(n).padStart(24, "0");

test("parseMergeRequest accepts a target and de-duplicated sources", () => {
    const result = parseMergeRequest(id(1), [id(2), id(3), id(2)]);
    assert.deepEqual(result, { ok: true, targetId: id(1), sourceIds: [id(2), id(3)] });
});

test("parseMergeRequest rejects merging a player into itself", () => {
    const result = parseMergeRequest(id(1), [id(2), id(1)]);
    assert.equal(result.ok, false);
    assert.match(result.error, /itself/);
});

test("parseMergeRequest rejects empty, malformed and oversized lists", () => {
    assert.equal(parseMergeRequest(id(1), []).ok, false);
    assert.equal(parseMergeRequest(id(1), "nope").ok, false);
    assert.equal(parseMergeRequest("bad", [id(2)]).ok, false);
    assert.equal(parseMergeRequest(id(1), ["{ $ne: 1 }"]).ok, false);
    const tooMany = Array.from({ length: MAX_MERGE_SOURCES + 1 }, (_, i) => id(i + 2));
    assert.equal(parseMergeRequest(id(1), tooMany).ok, false);
});

test("findSharedGames flags games where two different records have stats", () => {
    const rows = [
        { player: "a", game: "g1" },
        { player: "b", game: "g1" },
        { player: "a", game: "g2" },
        { player: "a", game: "g2" }, // same record twice in a game is not a clash
        { player: "c", game: "g3" },
    ];
    assert.deepEqual(findSharedGames(rows), [{ game: "g1", players: ["a", "b"] }]);
});

test("findSharedGames ignores incomplete rows", () => {
    assert.deepEqual(findSharedGames([{ player: "a" }, { game: "g1" }, null]), []);
});

test("mergeBlockers allows stand-in records from the same organization", () => {
    const target = { _id: "t", name: "Mike Zimmerman", organization: "org" };
    const sources = [{ _id: "s1", name: "We Da Best #56 (Winter 2011)", organization: "org" }];
    assert.deepEqual(mergeBlockers({ target, sources, missingSourceIds: [], rosteredSourceIds: new Set() }), []);
});

test("mergeBlockers refuses other orgs, login accounts, rostered and missing records", () => {
    const target = { _id: "t", name: "Mike Zimmerman", organization: "org" };
    const sources = [
        { _id: "s1", name: "Other Org #1 (Fall 2010)", organization: "other" },
        { _id: "s2", name: "Has Login", organization: "org", user: "u1" },
        { _id: "s3", name: "On Roster", organization: "org" },
    ];
    const blockers = mergeBlockers({ target, sources, missingSourceIds: ["s4"], rosteredSourceIds: new Set(["s3"]) });
    assert.equal(blockers.length, 4);
    assert.match(blockers.join("\n"), /no longer exist/);
    assert.match(blockers.join("\n"), /different organization/);
    assert.match(blockers.join("\n"), /login account/);
    assert.match(blockers.join("\n"), /team roster/);
});

test("mergeBlockers refuses when the kept player is gone", () => {
    assert.deepEqual(mergeBlockers({ target: null, sources: [], missingSourceIds: [], rosteredSourceIds: new Set() }), ["The player to keep no longer exists"]);
});

test("isStandInName recognizes the old-site jersey-only names only", () => {
    const { isStandInName } = require("../src/lib/playerMergePlan");
    assert.equal(isStandInName("We Da Best #56 (Winter 2011)"), true);
    assert.equal(isStandInName("Dirty Mike And The Boys #0 (Winter 2016)"), true);
    assert.equal(isStandInName("Worthy Opponents #? (Summer 2022)"), true);
    assert.equal(isStandInName("Former player #1234"), true);
    assert.equal(isStandInName("Mike Zimmerman"), false);
    assert.equal(isStandInName("Jesse (CHUY) Contreras"), false);
    assert.equal(isStandInName("John #1 Fan"), false);
    assert.equal(isStandInName(null), false);
});

test("seasonSortKey orders seasons within a year and across years", () => {
    const { seasonSortKey } = require("../src/lib/playerMergePlan");
    const names = ["Fall 2024", "Holiday 2023", "Winter 2024", "Summer 2024", "FALL 2019", "Odd League 2024"];
    const sorted = [...names].sort((a, b) => seasonSortKey(a) - seasonSortKey(b));
    assert.deepEqual(sorted, ["FALL 2019", "Holiday 2023", "Winter 2024", "Summer 2024", "Fall 2024", "Odd League 2024"]);
});
