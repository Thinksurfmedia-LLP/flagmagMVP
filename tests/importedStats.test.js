const test = require("node:test");
const assert = require("node:assert/strict");
const {
    legacyStatsToCategories,
    hasCategoryStats,
    importedLinesToStatRows,
} = require("../src/lib/importedStats.js");

// One row of the old XFlag `stats` table (per player, per game totals).
// PAT columns there already hold POINTS (1 or 2 per conversion), the same
// unit FlagMag's aggregateStats uses for `pat`.
const legacyRow = {
    PAttempts: 20, PCompletions: 14, PYards: 180, PTD: 3, PPAT: 4, PINT: 1, PSacks: 2, PSafety: 0,
    RReceptions: 1, RYards: 12, RTD: 1, RPAT: 2,
    DINT: 1, DTD: 1, DPAT: 2, DSacks: 0, DSafety: 1, DTackle: 0,
    RushAttempts: 3, RushYards: 21, RushTD: 0, RushPAT: 1,
    FlagPull: 4,
};

test("legacyStatsToCategories maps every old column onto FlagMag's field names", () => {
    assert.deepEqual(legacyStatsToCategories(legacyRow), {
        passing: { atts: 20, comp: 14, yards: 180, tds: 3, pat: 4, ints: 1, sacks: 2, safety: 0 },
        receiving: { receptions: 1, yards: 12, tds: 1, pat: 2 },
        rushing: { atts: 3, yards: 21, tds: 0, pat: 1 },
        defensive: { dint: 1, dintTD: 1, dtd: 1, dpat: 2, dsacks: 0, dsafety: 1, fumbles: 0, flagPulls: 4 },
    });
});

test("legacyStatsToCategories treats null/strings from the SQL dump as numbers", () => {
    const out = legacyStatsToCategories({ PAttempts: "5", PCompletions: null, FlagPull: "2" });
    assert.equal(out.passing.atts, 5);
    assert.equal(out.passing.comp, 0);
    assert.equal(out.defensive.flagPulls, 2);
});

test("hasCategoryStats is false for an all-zero category", () => {
    assert.equal(hasCategoryStats({ atts: 0, yards: 0 }), false);
    assert.equal(hasCategoryStats({ atts: 0, sacks: 1 }), true);
    assert.equal(hasCategoryStats(undefined), false);
});

const line = (overrides) => ({
    playerId: "p1",
    playerName: "Pat Passer",
    playerPhoto: "/p1.png",
    jerseyNumber: "7",
    teamName: "Darkside",
    ...legacyStatsToCategories(legacyRow),
    ...overrides,
});

test("importedLinesToStatRows produces rows shaped like aggregateStats output", () => {
    const rows = importedLinesToStatRows([line()]);

    assert.deepEqual(rows.passing, [{
        playerId: "p1", playerName: "Pat Passer", playerPhoto: "/p1.png", jerseyNumber: "7", teamName: "Darkside", legacy: true,
        atts: 20, comp: 14, yards: 180, tds: 3, pat: 4, ints: 1, sacks: 2, safety: 0,
        pct: 70, ypc: 12.9, rate: rows.passing[0].rate,
    }]);
    assert.ok(rows.passing[0].rate > 0);
    assert.deepEqual(rows.receiving[0], {
        playerId: "p1", playerName: "Pat Passer", playerPhoto: "/p1.png", jerseyNumber: "7", teamName: "Darkside", legacy: true,
        receptions: 1, yards: 12, tds: 1, pat: 2, ypr: 12,
    });
    assert.deepEqual(rows.rushing[0], {
        playerId: "p1", playerName: "Pat Passer", playerPhoto: "/p1.png", jerseyNumber: "7", teamName: "Darkside", legacy: true,
        atts: 3, yards: 21, tds: 0, pat: 1, ypc: 7,
    });
    assert.deepEqual(rows.defensive[0], {
        playerId: "p1", playerName: "Pat Passer", playerPhoto: "/p1.png", jerseyNumber: "7", teamName: "Darkside", legacy: true,
        dint: 1, dintTD: 1, dtd: 1, dpat: 2, dsacks: 0, dsafety: 1, fumbles: 0, flagPulls: 4,
    });
});

test("importedLinesToStatRows skips categories where the player recorded nothing", () => {
    const zeroed = { atts: 0, comp: 0, yards: 0, tds: 0, pat: 0, ints: 0, sacks: 0, safety: 0 };
    const rows = importedLinesToStatRows([line({ passing: zeroed, rushing: { atts: 0, yards: 0, tds: 0, pat: 0 } })]);
    assert.equal(rows.passing.length, 0);
    assert.equal(rows.rushing.length, 0);
    assert.equal(rows.receiving.length, 1);
    assert.equal(rows.defensive.length, 1);
});

test("importedLinesToStatRows uses the old-site rating and % and flags rows as legacy", () => {
    const { legacyPasserRating } = require("../src/lib/importedStats.js");
    const rows = importedLinesToStatRows([line()]);
    assert.equal(rows.passing[0].rate, legacyPasserRating(20, 14, 180, 3, 1, 4));
    for (const cat of ["passing", "receiving", "rushing", "defensive"]) {
        assert.equal(rows[cat][0].legacy, true, cat);
    }
});

// Expected values worked out by hand from the old PHP (FrontController.php
// :530-535 / com_xstats totals.php:276-281), which uses PHP round().
test("legacyPasserRating matches the old site's formula", () => {
    const { legacyPasserRating } = require("../src/lib/importedStats.js");
    // a=2, b=2.25, c=1.13, d=1.5, e=0.67 -> 7.55/0.06
    assert.equal(legacyPasserRating(20, 14, 180, 3, 1, 4), 125.8);
});

test("legacyPasserRating keeps c at exactly 2.375 when there are no interceptions", () => {
    const { legacyPasserRating, computePasserRating } = require("../src/lib/importedStats.js");
    // a=1, b=0, c=2.375, d=0.5, e=0 -> 3.875/0.06 = 64.58
    assert.equal(legacyPasserRating(10, 5, 50, 0, 0, 0), 64.6);
    assert.equal(computePasserRating(10, 5, 50, 0, 0, 0), 64.7, "current formula unchanged");
});

test("legacyPasserRating adds no PAT term when a passer has TDs but no PAT", () => {
    const { legacyPasserRating, computePasserRating } = require("../src/lib/importedStats.js");
    // a=1, b=1.5, c=0, d=0.5, e=0 -> 3/0.06
    assert.equal(legacyPasserRating(10, 5, 50, 1, 1, 0), 50);
    assert.equal(computePasserRating(10, 5, 50, 1, 1, 0), 39, "current formula unchanged");
});

test("legacyPasserRating gives 39.6 for a passing row with no attempts, as the old site did", () => {
    const { legacyPasserRating } = require("../src/lib/importedStats.js");
    assert.equal(legacyPasserRating(0, 0, 0, 0, 0, 0), 39.6);
});

test("legacyCompletionPct rounds half up like PHP round()", () => {
    const { legacyCompletionPct } = require("../src/lib/importedStats.js");
    assert.equal(legacyCompletionPct(51, 80), 63.8); // 63.75 — JS toFixed gives 63.7
    assert.equal(legacyCompletionPct(14, 20), 70);
    assert.equal(legacyCompletionPct(0, 0), 0);
    assert.equal(legacyCompletionPct(0, 5), 0);
});

test("passingDerived picks the legacy formulas only for legacy rows", () => {
    const { passingDerived } = require("../src/lib/importedStats.js");
    const totals = { atts: 10, comp: 5, yards: 50, tds: 1, ints: 1, pat: 0 };
    assert.deepEqual(passingDerived(totals, true), { pct: 50, ypc: 10, rate: 50 });
    assert.deepEqual(passingDerived(totals, false), { pct: 50, ypc: 10, rate: 39 });
});
