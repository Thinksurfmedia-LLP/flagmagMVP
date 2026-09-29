const test = require("node:test");
const assert = require("node:assert/strict");
const { teamLeagueSummary, teamLabel, sortTeamsForPicker } = require("../src/lib/teamLabel.js");

const league = (name, season, type = "active") => ({ league: { name, type, season: season ? { name: season } : null } });
const beverly = { _id: "b", name: "Trojans", leagues: [league("Beverly Spring 2026", "Spring 2026", "past"), league("Beverly Playoff Spring 2026", "Spring 2026", "past")] };
const sdThu = { _id: "s", name: "Trojans", leagues: [league("SD Thu", "Fall 2026")] };

test("the two Trojans get different labels", () => {
    assert.equal(teamLabel(sdThu), "Trojans — SD Thu (Fall 2026)");
    assert.equal(teamLabel(beverly), "Trojans — Beverly Spring 2026, Beverly Playoff Spring 2026 (past)");
    assert.notEqual(teamLabel(sdThu), teamLabel(beverly));
});

test("season isn't repeated when the league name already contains it", () => {
    assert.equal(teamLeagueSummary({ leagues: [league("Beverly Spring 2026", "Spring 2026")] }), "Beverly Spring 2026");
});

test("current leagues are shown; past ones are dropped when a current one exists", () => {
    const t = { name: "Mambas", leagues: [league("North Park", "Summer 2026", "past"), league("North Park", "Fall 2026")] };
    assert.equal(teamLeagueSummary(t), "North Park (Fall 2026)");
});

test("long league lists are shortened", () => {
    const t = { name: "X", leagues: [league("A", "Fall 2026"), league("B", "Fall 2026"), league("C", "Fall 2026"), league("D", "Fall 2026")] };
    assert.equal(teamLeagueSummary(t), "A (Fall 2026), B (Fall 2026) +2 more");
});

test("teams without leagues, or with unpopulated leagues, are labelled safely", () => {
    assert.equal(teamLabel({ name: "Free Team", leagues: [] }), "Free Team — no league");
    assert.equal(teamLabel({ name: "Raw", leagues: [{ league: "65f0c0ffee" }] }), "Raw — no league");
    assert.equal(teamLabel({ name: "Nothing" }), "Nothing — no league");
});

test("pickers list current-league teams first, then past, then none, alphabetically", () => {
    const none = { _id: "n", name: "Aardvarks", leagues: [] };
    const current2 = { _id: "c", name: "Bears", leagues: [league("SD Thu", "Fall 2026")] };
    const sorted = sortTeamsForPicker([beverly, none, sdThu, current2]).map((t) => t._id);
    assert.deepEqual(sorted, ["c", "s", "b", "n"]);
});

test("sortTeamsForPicker doesn't mutate its input", () => {
    const input = [beverly, sdThu];
    sortTeamsForPicker(input);
    assert.deepEqual(input.map((t) => t._id), ["b", "s"]);
});
