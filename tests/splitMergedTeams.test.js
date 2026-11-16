const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../scripts/legacy/split-merged-teams.mjs");
const set = (...ids) => new Set(ids.map(String));
const unit = (leagueId, family, players, extra = {}) => ({ leagueId, family, players, tournament: false, native: false, startDate: 0, ...extra });

test("location variants collapse to one location", async () => {
    const { locationFamily } = await load();
    assert.equal(locationFamily("Riverside Playoffs"), "riverside");
    assert.equal(locationFamily("Holiday Riverside (Playoffs)"), "riverside");
    assert.equal(locationFamily("Riverside (SUN)"), "riverside");
    assert.equal(locationFamily("Temecula (Wed)"), "temecula");
    assert.notEqual(locationFamily("Oceanside"), locationFamily("San Marcos"));
});

test("The Boys: Riverside (no shared players) splits off; Oceanside/San Marcos/Poway/tournaments stay", async () => {
    const { planSplit } = await load();
    const roster = set(1, 2, 3, 4, 5, 6, 7, 8);
    const units = [
        unit("oce", "oceanside", set(1, 2, 3, 4, 5, 6), { native: true }),
        unit("sm", "san marcos", set(1, 2, 3, 9)),
        unit("poway", "4s poway", set(2, 3, 4, 10)),
        unit("cash", "cash counties xxii", set(1, 2, 3), { tournament: true }),
        unit("riv22", "riverside", set(50, 51, 52, 53)),
        unit("riv23", "riverside", set(50, 54, 55)),
        unit("chino", "chino", set(50, 51, 60, 61, 62, 63)),
    ];
    const { keep, moves } = planSplit(units, roster);
    assert.deepEqual(keep.sort(), ["cash", "oce", "poway", "sm"]);
    assert.equal(moves.length, 1);
    assert.deepEqual(moves[0].sort(), ["chino", "riv22", "riv23"]);
});

test("a league without enough player evidence never moves", async () => {
    const { planSplit } = await load();
    const units = [
        unit("a", "oceanside", set(1, 2, 3), { native: true }),
        unit("b", "riverside", set(90, 91)), // only 2 players: not enough to call it another team
        unit("c", "chino", set()),
    ];
    const { keep, moves } = planSplit(units, set(1, 2, 3));
    assert.deepEqual(moves, []);
    assert.deepEqual(keep.sort(), ["a", "b", "c"]);
});

test("native (FlagMag-created) leagues always stay on the existing team, even with different players", async () => {
    const { planSplit } = await load();
    const units = [
        unit("n1", "oceanside", set(1, 2, 3), { native: true }),
        unit("n2", "riverside", set(7, 8, 9), { native: true }),
        unit("old", "riverside", set(7, 8, 9, 10)),
    ];
    const { keep, moves } = planSplit(units, set(1, 2, 3));
    assert.deepEqual(moves, []);
    assert.deepEqual(keep.sort(), ["n1", "n2", "old"]);
});

test("fully imported team: the group sharing the current roster keeps the record", async () => {
    const { planSplit } = await load();
    const units = [
        unit("x1", "riverside", set(1, 2, 3, 4), { startDate: 100 }),
        unit("y1", "carlsbad", set(20, 21, 22, 23), { startDate: 200 }),
    ];
    const { keep, moves } = planSplit(units, set(1, 2));
    assert.deepEqual(keep, ["x1"]);
    assert.deepEqual(moves, [["y1"]]);
});

test("a tournament with no shared players stays with the existing team", async () => {
    const { planSplit } = await load();
    const units = [
        unit("home", "oceanside", set(1, 2, 3), { native: true }),
        unit("away", "riverside", set(40, 41, 42)),
        unit("cash", "cash counties", set(70, 71, 72), { tournament: true }),
    ];
    const { keep, moves } = planSplit(units, set(1, 2, 3));
    assert.deepEqual(keep.sort(), ["cash", "home"]);
    assert.deepEqual(moves, [["away"]]);
});

test("many shared players means the same team, even below the ratio (nothing moves)", async () => {
    const { planSplit } = await load();
    const big = set(...Array.from({ length: 50 }, (_, i) => i));
    const other = set(...Array.from({ length: 11 }, (_, i) => i), ...Array.from({ length: 55 }, (_, i) => 100 + i)); // 11 of 66 shared
    const units = [unit("poway", "4s poway", big, { native: true }), unit("mm", "mm", other)];
    const { keep, moves } = planSplit(units, set(1));
    assert.deepEqual(moves, []);
    assert.deepEqual(keep.sort(), ["mm", "poway"]);
});
