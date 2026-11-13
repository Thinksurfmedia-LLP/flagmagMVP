const test = require("node:test");
const assert = require("node:assert/strict");
const { playerTeamsPayload, wouldRemoveFromAllTeams } = require("../src/lib/playerTeamsPayload.js");

const inferno = { teamId: "t1", teamName: "Inferno", jerseyNumber: 65 };
const hawks = { teamId: "t2", teamName: "Hawks", jerseyNumber: 7 };

test("photo/name-only edit sends no team data", () => {
    assert.deepEqual(playerTeamsPayload({ initial: [inferno], current: [inferno], teamsKnown: true }), {});
});

test("teams not loaded when the form opened: never sends team data, even if the list looks empty", () => {
    // The Julian Noble case — the roster list hadn't loaded, so the form
    // opened with no teams and a photo save wiped his Inferno membership.
    assert.deepEqual(playerTeamsPayload({ initial: [], current: [], teamsKnown: false }), {});
    assert.deepEqual(playerTeamsPayload({ initial: [], current: [hawks], teamsKnown: false }), {});
});

test("jersey change counts as a team change", () => {
    const renumbered = { ...inferno, jerseyNumber: "12" };
    assert.deepEqual(playerTeamsPayload({ initial: [inferno], current: [renumbered], teamsKnown: true }), { teams: [renumbered] });
});

test("jersey number compared as a value (\"65\" equals 65)", () => {
    assert.deepEqual(playerTeamsPayload({ initial: [inferno], current: [{ ...inferno, jerseyNumber: "65" }], teamsKnown: true }), {});
});

test("adding a team sends the full list", () => {
    assert.deepEqual(playerTeamsPayload({ initial: [inferno], current: [inferno, hawks], teamsKnown: true }), { teams: [inferno, hawks] });
});

test("deliberately removing every team is flagged as intentional", () => {
    assert.deepEqual(playerTeamsPayload({ initial: [inferno], current: [], teamsKnown: true }), { teams: [], removeFromAllTeams: true });
});

test("order of teams doesn't count as a change", () => {
    assert.deepEqual(playerTeamsPayload({ initial: [inferno, hawks], current: [hawks, inferno], teamsKnown: true }), {});
});

test("server guard: empty list on a rostered player needs the explicit flag", () => {
    assert.equal(wouldRemoveFromAllTeams({ teams: [] }, 1), true);
    assert.equal(wouldRemoveFromAllTeams({ teams: [], removeFromAllTeams: true }, 1), false);
    assert.equal(wouldRemoveFromAllTeams({ teams: [] }, 0), false);
    assert.equal(wouldRemoveFromAllTeams({ teams: [hawks] }, 1), false);
    assert.equal(wouldRemoveFromAllTeams({ name: "x" }, 1), false);
});
