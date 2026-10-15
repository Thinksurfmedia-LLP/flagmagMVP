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
        playerId: "p1", playerName: "Pat Passer", playerPhoto: "/p1.png", jerseyNumber: "7", teamName: "Darkside",
        atts: 20, comp: 14, yards: 180, tds: 3, pat: 4, ints: 1, sacks: 2, safety: 0,
        pct: 70, ypc: 12.9, rate: rows.passing[0].rate,
    }]);
    assert.ok(rows.passing[0].rate > 0);
    assert.deepEqual(rows.receiving[0], {
        playerId: "p1", playerName: "Pat Passer", playerPhoto: "/p1.png", jerseyNumber: "7", teamName: "Darkside",
        receptions: 1, yards: 12, tds: 1, pat: 2, ypr: 12,
    });
    assert.deepEqual(rows.rushing[0], {
        playerId: "p1", playerName: "Pat Passer", playerPhoto: "/p1.png", jerseyNumber: "7", teamName: "Darkside",
        atts: 3, yards: 21, tds: 0, pat: 1, ypc: 7,
    });
    assert.deepEqual(rows.defensive[0], {
        playerId: "p1", playerName: "Pat Passer", playerPhoto: "/p1.png", jerseyNumber: "7", teamName: "Darkside",
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

test("importedLinesToStatRows passer rating matches the shared formula", () => {
    const { computePasserRating } = require("../src/lib/importedStats.js");
    const rows = importedLinesToStatRows([line()]);
    assert.equal(rows.passing[0].rate, computePasserRating(20, 14, 180, 3, 1, 4));
});
