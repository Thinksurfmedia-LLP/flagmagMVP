const test = require("node:test");
const assert = require("node:assert/strict");
const { parseGameListQuery, applyGameListQuery, MAX_LIMIT } = require("../src/lib/gameListQuery.js");

const params = (q) => new URLSearchParams(q);
const game = (id, league, status) => ({ _id: id, league, status });
// Already in the route's ascending date order.
const GAMES = [game("g1", "L1", "completed"), game("g2", "L2", "completed"), game("g3", "L1", "upcoming"), game("g4", "L1", "completed")];

test("no params means the original behaviour: everything, ascending", () => {
    const q = parseGameListQuery(params(""));
    assert.deepEqual(q, { status: null, season: null, order: "asc", limit: null });
    assert.deepEqual(applyGameListQuery(GAMES, q, null).map((g) => g._id), ["g1", "g2", "g3", "g4"]);
});

test("parses status, season, order and limit", () => {
    assert.deepEqual(
        parseGameListQuery(params("status=completed&season=default&order=desc&limit=20")),
        { status: "completed", season: "default", order: "desc", limit: 20 }
    );
});

test("ignores invalid order/limit values and caps limit", () => {
    const q = parseGameListQuery(params("order=sideways&limit=-3"));
    assert.equal(q.order, "asc");
    assert.equal(q.limit, null);
    assert.equal(parseGameListQuery(params("limit=abc")).limit, null);
    assert.equal(parseGameListQuery(params(`limit=${MAX_LIMIT + 50}`)).limit, MAX_LIMIT);
});

test("filters by status and league set, newest first, limited", () => {
    const q = parseGameListQuery(params("status=completed&order=desc&limit=2"));
    const out = applyGameListQuery(GAMES, q, new Set(["L1"]));
    assert.deepEqual(out.map((g) => g._id), ["g4", "g1"]);
});

test("does not mutate the cached input array", () => {
    const input = [...GAMES];
    applyGameListQuery(input, parseGameListQuery(params("order=desc")), null);
    assert.deepEqual(input, GAMES);
});

test("league ids match whether stored as strings or ObjectId-like values", () => {
    const objectIdLike = { toString: () => "L2" };
    const out = applyGameListQuery([game("x", objectIdLike, "completed")], parseGameListQuery(params("")), new Set(["L2"]));
    assert.equal(out.length, 1);
});
