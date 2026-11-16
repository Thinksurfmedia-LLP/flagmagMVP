const test = require("node:test");
const assert = require("node:assert/strict");
const { filterAndSortTeams, leagueOptions } = require("../src/lib/teamPickerFilter");

const league = (id, name, season, type = "active") => ({ league: { _id: id, name, type, season: { name: season } } });
const teams = [
    { _id: "1", name: "Trojans", leagues: [league("sd", "SD Thu", "Fall 2026")] },
    { _id: "2", name: "Trojans", leagues: [league("bev", "Beverly", "Spring 2026", "past")] },
    { _id: "3", name: "Agents", leagues: [league("hon", "Honolulu", "Fall 2009", "past")] },
    { _id: "4", name: "Blitz", leagues: [league("sd", "SD Thu", "Fall 2026"), league("rp", "Riverside Playoffs", "Fall 2026")] },
    { _id: "5", name: "TBD", isPlaceholder: true, leagues: [league("sd", "SD Thu", "Fall 2026")] },
    { _id: "6", name: "Zeta", leagues: [] },
];
const ids = (list) => list.map((t) => t._id);

test("current season only by default, A–Z, placeholders hidden", () => {
    assert.deepEqual(ids(filterAndSortTeams(teams)), ["4", "1"]);
});

test("past and all scopes", () => {
    assert.deepEqual(ids(filterAndSortTeams(teams, { scope: "past" })), ["3", "2", "6"]);
    assert.deepEqual(ids(filterAndSortTeams(teams, { scope: "all" })), ["3", "4", "1", "2", "6"]);
});

test("search matches team, league and season words in any order", () => {
    assert.deepEqual(ids(filterAndSortTeams(teams, { scope: "all", query: "trojans beverly" })), ["2"]);
    assert.deepEqual(ids(filterAndSortTeams(teams, { scope: "all", query: "2009" })), ["3"]);
    assert.deepEqual(ids(filterAndSortTeams(teams, { query: "riverside" })), ["4"]);
});

test("league filter, exclusions and sorts", () => {
    assert.deepEqual(ids(filterAndSortTeams(teams, { leagueId: "sd", excludeIds: new Set(["4"]) })), ["1"]);
    assert.deepEqual(ids(filterAndSortTeams(teams, { scope: "all", sort: "name-desc" })), ["6", "1", "2", "4", "3"]);
    assert.deepEqual(ids(filterAndSortTeams(teams, { scope: "all", sort: "newest" })), ["4", "1", "2", "3", "6"]);
});

test("league options are newest first and follow the scope", () => {
    assert.deepEqual(leagueOptions(teams, "current"), [
        { id: "rp", label: "Riverside Playoffs (Fall 2026)" },
        { id: "sd", label: "SD Thu (Fall 2026)" },
    ]);
    assert.deepEqual(leagueOptions(teams, "all").map((o) => o.id), ["rp", "sd", "bev", "hon"]);
});
