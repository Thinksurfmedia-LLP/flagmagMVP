const test = require("node:test");
const assert = require("node:assert/strict");
const { compareStandings } = require("../src/lib/standingsSort.js");

const row = (name, pct, diff, extra = {}) => ({ name, pct, diff, pf: 0, seedNumber: null, ...extra });
const order = (rows) => [...rows].sort(compareStandings).map((r) => r.name);

test("higher win percentage ranks first", () => {
    assert.deepEqual(order([row("A", 0, 50), row("B", 100, -5)]), ["B", "A"]);
});

test("equal win percentage falls back to point differential, not points-for", () => {
    // The reported case: Rugrats (0%, -22, PF 50) ranked above G Team (0%, -9, PF 46).
    const rugrats = row("Rugrats", 0, -22, { pf: 50 });
    const gTeam = row("G Team", 0, -9, { pf: 46 });
    assert.deepEqual(order([rugrats, gTeam]), ["G Team", "Rugrats"]);
});

test("record outranks playoff seed once games are played", () => {
    const rugrats = row("Rugrats", 0, -22, { seedNumber: 2 });
    const mambas = row("Mambas", 50, 21, { seedNumber: 3 });
    assert.deepEqual(order([rugrats, mambas]), ["Mambas", "Rugrats"]);
});

test("seed breaks a full tie (e.g. a 0-0 playoff bracket), unseeded teams last", () => {
    const rows = [row("C", 0, 0, { seedNumber: 3 }), row("X", 0, 0), row("A", 0, 0, { seedNumber: 1 })];
    assert.deepEqual(order(rows), ["A", "C", "X"]);
});
