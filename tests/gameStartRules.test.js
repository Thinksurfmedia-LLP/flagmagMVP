const test = require("node:test");
const assert = require("node:assert/strict");
const { MIN_PLAYERS_TO_START, activePlayerCount, findStartBlockers } = require("../src/lib/gameStartRules.js");

const players = (n, extra = []) => [...Array.from({ length: n }, (_, i) => ({ player: `p${i}`, jerseyNumber: i })), ...extra];
const real = (name, n, extra) => ({ name, isPlaceholder: false, players: players(n, extra) });
const placeholder = (name) => ({ name, isPlaceholder: true, players: [] });

test("minimum roster size is 4", () => {
    assert.equal(MIN_PLAYERS_TO_START, 4);
});

test("activePlayerCount ignores players deactivated for the team", () => {
    assert.equal(activePlayerCount(real("A", 4, [{ player: "x", active: false }])), 4);
    assert.equal(activePlayerCount(real("A", 3, [{ player: "x", active: false }])), 3);
    assert.equal(activePlayerCount(null), 0);
});

test("two real teams with 4+ active players can start", () => {
    const out = findStartBlockers({ name: "A" }, real("A", 4), { name: "B" }, real("B", 6));
    assert.deepEqual(out, { placeholders: [], shortRosters: [] });
});

test("placeholder sides (e.g. D1 Championship) block the start, detected by flag", () => {
    const out = findStartBlockers(
        { name: "D1 Championship" }, placeholder("D1 Championship"),
        { name: "D2 Championship" }, placeholder("D2 Championship"),
    );
    assert.deepEqual(out.placeholders, ["D1 Championship", "D2 Championship"]);
    assert.deepEqual(out.shortRosters, [], "placeholders are not reported as short rosters");
});

test("teams with fewer than 4 active players are reported", () => {
    const out = findStartBlockers({ name: "A" }, real("A", 3), { name: "B" }, real("B", 4, [{ player: "x", active: false }]));
    assert.deepEqual(out, { placeholders: [], shortRosters: ["A"] });
});

test("a side whose team can't be found counts as a short roster", () => {
    const out = findStartBlockers({ name: "Ghost" }, null, { name: "B" }, real("B", 4));
    assert.deepEqual(out.shortRosters, ["Ghost"]);
});
