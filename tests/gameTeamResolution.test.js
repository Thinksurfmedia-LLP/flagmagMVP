const test = require("node:test");
const assert = require("node:assert/strict");
const {
    buildTeamIndex,
    resolveGameSide,
    teamIdToKeep,
    seedNumberFor,
    enrichGameTeams,
    planTeamIdBackfill,
} = require("../src/lib/gameTeamResolution.js");

const SD_THU = "league-sd-thu";
const TEMECULA = "league-temecula";

// The real-world collision: two unrelated "Trojans" in one organization,
// each in its own league, with different logos. Temecula's is listed LAST,
// which is exactly the order that used to win the org-wide name map.
const sdTrojans = { _id: "t-sd", name: "Trojans", logo: "/sd-trojans.png", leagues: [{ league: SD_THU }] };
const goat = { _id: "t-goat", name: "GOAT", logo: "/goat.png", leagues: [{ league: SD_THU, seedNumber: 2 }] };
const temeculaTrojans = { _id: "t-tem", name: "Trojans", logo: "/usc-trojans.png", leagues: [{ league: TEMECULA, seedNumber: 5 }] };
const tbd = { _id: "t-tbd", name: "TBD", logo: "", isPlaceholder: true, leagues: [] };
const TEAMS = [sdTrojans, goat, temeculaTrojans, tbd];

test("resolves by teamId first, regardless of name collisions", () => {
    const index = buildTeamIndex(TEAMS);
    const side = { teamId: "t-sd", name: "Trojans" };
    assert.equal(resolveGameSide(side, TEMECULA, index), sdTrojans);
});

test("legacy game without teamId resolves within its own league, not org-wide", () => {
    const index = buildTeamIndex(TEAMS);
    assert.equal(resolveGameSide({ name: "Trojans" }, SD_THU, index), sdTrojans);
    assert.equal(resolveGameSide({ name: "Trojans" }, TEMECULA, index), temeculaTrojans);
});

test("a stale teamId (team deleted) falls back to league + name", () => {
    const index = buildTeamIndex(TEAMS);
    assert.equal(resolveGameSide({ teamId: "gone", name: "Trojans" }, SD_THU, index), sdTrojans);
});

test("a teamId survives a team rename (game still carries the old name)", () => {
    const renamed = { ...sdTrojans, name: "SD Trojans" };
    const index = buildTeamIndex([renamed, temeculaTrojans]);
    assert.equal(resolveGameSide({ teamId: "t-sd", name: "Trojans" }, SD_THU, index), renamed);
});

test("placeholder teams resolve by name even though they're in no league", () => {
    const index = buildTeamIndex(TEAMS);
    assert.equal(resolveGameSide({ name: "TBD" }, SD_THU, index), tbd);
});

test("a league member wins over a same-named placeholder", () => {
    const realTbd = { _id: "t-real-tbd", name: "TBD", logo: "/x.png", leagues: [{ league: SD_THU }] };
    const index = buildTeamIndex([tbd, realTbd]);
    assert.equal(resolveGameSide({ name: "TBD" }, SD_THU, index), realTbd);
});

test("unknown names and empty sides resolve to null", () => {
    const index = buildTeamIndex(TEAMS);
    assert.equal(resolveGameSide({ name: "Nobody" }, SD_THU, index), null);
    assert.equal(resolveGameSide(undefined, SD_THU, index), null);
    assert.equal(resolveGameSide({}, SD_THU, index), null);
});

test("ObjectId-like ids (toString) are matched as strings", () => {
    const oid = (s) => ({ toString: () => s });
    const index = buildTeamIndex([{ ...sdTrojans, _id: oid("t-sd"), leagues: [{ league: oid(SD_THU) }] }]);
    assert.equal(resolveGameSide({ teamId: oid("t-sd") }, oid(TEMECULA), index).name, "Trojans");
    assert.equal(resolveGameSide({ name: "Trojans" }, oid(SD_THU), index).logo, "/sd-trojans.png");
});

test("seedNumberFor reads only this league's membership", () => {
    assert.equal(seedNumberFor(goat, SD_THU), 2);
    assert.equal(seedNumberFor(goat, TEMECULA), null);
    assert.equal(seedNumberFor(null, SD_THU), null);
});

test("enrichGameTeams shows the SD Thu Trojans logo on an SD Thu game (the reported bug)", () => {
    const index = buildTeamIndex(TEAMS);
    const game = {
        _id: "g1",
        league: SD_THU,
        teamA: { name: "GOAT", logo: "/old-goat.png", score: 50 },
        teamB: { name: "Trojans", logo: "/old.png", score: 6 },
    };
    const out = enrichGameTeams(game, index);
    assert.equal(out.teamB.logo, "/sd-trojans.png");
    assert.equal(String(out.teamB.teamId), "t-sd");
    assert.equal(out.teamA.logo, "/goat.png");
    assert.equal(out.teamB.score, 6);
    assert.equal(out.teamA.seedNumber, null, "no seed outside playoffs");
});

test("enrichGameTeams does not mutate the input game", () => {
    const index = buildTeamIndex(TEAMS);
    const game = { league: SD_THU, teamA: { name: "GOAT", logo: "" }, teamB: { name: "Trojans", logo: "" } };
    const snapshot = JSON.stringify(game);
    enrichGameTeams(game, index);
    assert.equal(JSON.stringify(game), snapshot);
});

test("enrichGameTeams adds seeds for playoffs and details on request", () => {
    const index = buildTeamIndex(TEAMS);
    const game = { league: SD_THU, teamA: { name: "GOAT" }, teamB: { name: "Trojans" } };
    const out = enrichGameTeams(game, index, { isPlayoffs: true, withDetails: true });
    assert.equal(out.teamA.seedNumber, 2);
    assert.equal(out.teamA.details, goat);
    assert.equal(out.teamB.details, sdTrojans);
});

test("enrichGameTeams keeps the stored logo when the team can't be found", () => {
    const index = buildTeamIndex([]);
    const game = { league: SD_THU, teamA: { name: "Ghost", logo: "/snap.png" }, teamB: { name: "X" } };
    const out = enrichGameTeams(game, index);
    assert.equal(out.teamA.logo, "/snap.png");
    assert.equal(out.teamA.teamId, null);
    assert.equal(out.teamB.logo, "");
});

test("planTeamIdBackfill prefers the schedule's team ids, then league + name", () => {
    const index = buildTeamIndex(TEAMS);
    const games = [
        { _id: "g1", league: SD_THU, teamA: { name: "GOAT" }, teamB: { name: "Trojans" } },
        { _id: "g2", league: TEMECULA, teamA: { name: "Trojans" }, teamB: { name: "Nobody" } },
        { _id: "g3", league: SD_THU, teamA: { teamId: "t-goat", name: "GOAT" }, teamB: { teamId: "t-sd", name: "Trojans" } },
    ];
    const scheduleTeamsByGame = new Map([["g1", { team1: "t-goat", team2: "t-sd" }]]);
    const plan = planTeamIdBackfill(games, index, scheduleTeamsByGame);

    assert.deepEqual(plan.updates, [
        { gameId: "g1", set: { "teamA.teamId": "t-goat", "teamB.teamId": "t-sd" }, sources: { A: "schedule", B: "schedule" } },
        { gameId: "g2", set: { "teamA.teamId": "t-tem" }, sources: { A: "league+name" } },
    ]);
    assert.deepEqual(plan.unresolved, [{ gameId: "g2", side: "B", name: "Nobody", league: TEMECULA }]);
    assert.equal(plan.alreadyLinked, 2);
});

test("planTeamIdBackfill ignores a schedule id whose team name disagrees with the game", () => {
    const index = buildTeamIndex(TEAMS);
    const games = [{ _id: "g1", league: SD_THU, teamA: { name: "GOAT" }, teamB: { name: "Trojans" } }];
    // Schedule drifted: team2 points at Temecula's Trojans' id... still "Trojans",
    // but the team isn't in this game's league — must not be trusted.
    const scheduleTeamsByGame = new Map([["g1", { team1: "t-sd", team2: "t-tem" }]]);
    const plan = planTeamIdBackfill(games, index, scheduleTeamsByGame);
    assert.deepEqual(plan.updates[0].set, { "teamA.teamId": "t-goat", "teamB.teamId": "t-sd" });
    assert.deepEqual(plan.updates[0].sources, { A: "league+name", B: "league+name" });
});

test("teamIdToKeep keeps the link when an update re-sends the unchanged (possibly stale) name", () => {
    const existing = { league: SD_THU, teamA: { teamId: "t-sd", name: "Trojans" }, teamB: { name: "GOAT" } };
    assert.equal(teamIdToKeep(existing, "A", "Trojans", SD_THU), "t-sd");
});

test("teamIdToKeep re-resolves when the name, league or link changes", () => {
    const existing = { league: SD_THU, teamA: { teamId: "t-sd", name: "Trojans" }, teamB: { name: "GOAT" } };
    assert.equal(teamIdToKeep(existing, "A", "GOAT", SD_THU), undefined, "team swapped");
    assert.equal(teamIdToKeep(existing, "A", "Trojans", TEMECULA), undefined, "game moved league");
    assert.equal(teamIdToKeep(existing, "B", "GOAT", SD_THU), undefined, "never linked");
    assert.equal(teamIdToKeep(null, "A", "Trojans", SD_THU), undefined, "create, no existing game");
});
