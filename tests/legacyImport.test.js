const test = require("node:test");
const assert = require("node:assert/strict");
const {
    cleanTeamName,
    teamMatchKey,
    teamLooseKey,
    parseSeed,
    leagueTypeFor,
    baseLocationName,
    categoryFor,
    groupGamesIntoWeeks,
    sideForStat,
    normalizePersonName,
} = require("../src/lib/legacyImport.js");

test("cleanTeamName strips playoff seed prefixes and season suffixes", () => {
    assert.equal(cleanTeamName("D1 #2 Mountain Goats F25"), "Mountain Goats");
    assert.equal(cleanTeamName("D2 #10 Paper Boyz F25"), "Paper Boyz");
    assert.equal(cleanTeamName("#1 Raptors"), "Raptors");
    assert.equal(cleanTeamName("DouxBoyz H25"), "DouxBoyz");
    assert.equal(cleanTeamName("Dream Team W25"), "Dream Team");
    assert.equal(cleanTeamName("NC Cobras S24"), "NC Cobras");
    assert.equal(cleanTeamName("  DARKSIDE  "), "DARKSIDE");
    // A trailing token that is not a season tag is part of the name.
    assert.equal(cleanTeamName("Rugrats Saturday"), "Rugrats Saturday");
    assert.equal(cleanTeamName("Area 51"), "Area 51");
});

test("cleanTeamName handles the older naming variants", () => {
    assert.equal(cleanTeamName("BallHawks SP25"), "BallHawks");
    assert.equal(cleanTeamName("RawDawgs X23"), "RawDawgs");
    assert.equal(cleanTeamName("W23 #1 Goblins"), "Goblins");
    assert.equal(cleanTeamName("#1 Trojans S23"), "Trojans");
    assert.equal(cleanTeamName("Code Yellow F22 #1"), "Code Yellow");
    assert.equal(cleanTeamName("The Mountain Goats #2"), "The Mountain Goats");
    assert.equal(cleanTeamName("D-1 Championship #1 GOAT S24"), "GOAT");
    assert.equal(cleanTeamName("D-2 #3 Street Smart S24"), "Street Smart");
    // Location-qualified duplicates stay distinct from the plain team.
    assert.equal(cleanTeamName("RawDawgs W25 - Oside"), "RawDawgs - Oside");
    // Old stand-in "stat game" teams follow FlagMag's "<Team> STATS" convention.
    assert.equal(cleanTeamName("Bring It S24 STAT GAME"), "Bring It STATS");
});

test("parseSeed handles the older seed spellings", () => {
    assert.deepEqual(parseSeed("D-1 Championship #1 GOAT S24"), { division: "D1", seedNumber: 1 });
    assert.deepEqual(parseSeed("W23 #2 NC Cobras"), { division: "", seedNumber: 2 });
    assert.deepEqual(parseSeed("Code Yellow F22 #1"), { division: "", seedNumber: 1 });
});

test("teamMatchKey is case- and whitespace-insensitive", () => {
    assert.equal(teamMatchKey("D1 #1 DARKSIDE F25"), teamMatchKey("Darkside"));
    assert.equal(teamMatchKey("N&B"), "n&b");
});

test("teamLooseKey ignores spacing and punctuation for near-identical names", () => {
    assert.equal(teamLooseKey("DouxBoyz H25"), teamLooseKey("Doux Boys"));
    assert.equal(teamLooseKey("Bring It F25"), teamLooseKey("BringIt"));
    assert.notEqual(teamLooseKey("Mountain Goats"), teamLooseKey("GOAT"));
});

test("parseSeed reads division and seed from the old playoff naming", () => {
    assert.deepEqual(parseSeed("D1 #2 Mountain Goats F25"), { division: "D1", seedNumber: 2 });
    assert.deepEqual(parseSeed("#3 Vipers"), { division: "", seedNumber: 3 });
    assert.deepEqual(parseSeed("Mountain Goats F25"), { division: "", seedNumber: null });
});

test("leagueTypeFor marks playoff and tournament locations as playoffs", () => {
    assert.equal(leagueTypeFor("Temecula Playoffs"), "playoffs");
    assert.equal(leagueTypeFor("Holiday Riverside H24 (Playoffs)"), "playoffs");
    assert.equal(leagueTypeFor("CASH COUNTIES XXI"), "playoffs");
    assert.equal(leagueTypeFor("Temecula"), "league");
    assert.equal(leagueTypeFor("Christmas 2025"), "league");
});

test("baseLocationName drops the playoff qualifier", () => {
    assert.equal(baseLocationName("Temecula Playoffs"), "Temecula");
    assert.equal(baseLocationName("Holiday Riverside H24 (Playoffs)"), "Holiday Riverside H24");
    assert.equal(baseLocationName("North Park"), "North Park");
});

test("categoryFor follows the current XFlag league categories", () => {
    assert.equal(categoryFor("SD Womens"), "Women");
    assert.equal(categoryFor("SD Womens Playoffs"), "Women");
    assert.equal(categoryFor("Beverly"), "Youth");
    assert.equal(categoryFor("Temecula"), "Men");
});

test("groupGamesIntoWeeks makes one week per distinct date, in date order", () => {
    const weeks = groupGamesIntoWeeks([
        { id: 3, date: "2025-09-28", time: "19:00" },
        { id: 1, date: "2025-09-21", time: "20:10" },
        { id: 2, date: "2025-09-21", time: "18:00" },
    ]);
    assert.deepEqual(weeks.map((w) => w.name), ["Week 1 - 9/21/25", "Week 2 - 9/28/25"]);
    assert.deepEqual(weeks[0].games.map((g) => g.id), [2, 1]);
});

test("sideForStat maps a stats row onto game side A or B by its sldt id", () => {
    const game = { sldt_id1: 10, sldt_id2: 20 };
    assert.equal(sideForStat(game, 10), "A");
    assert.equal(sideForStat(game, "20"), "B");
    assert.equal(sideForStat(game, 99), null);
});

test("normalizePersonName collapses whitespace and case", () => {
    assert.equal(normalizePersonName("  Frank   Kielbasa "), "frank kielbasa");
});
