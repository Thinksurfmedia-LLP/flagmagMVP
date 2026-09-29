const test = require("node:test");
const assert = require("node:assert/strict");
const { isNoStatsTeamName, validateNoStatsTeams } = require("../src/lib/noStatsTeams.js");

const ORG = "org1";
const base = () => ({
    original: { teamA: { name: "GOAT" }, teamB: { name: "Trojans" }, noStatsBothSides: false },
    league: { organization: ORG },
    realTeamDoc: { _id: "goat", name: "GOAT", organization: ORG },
    standInTeamDoc: { _id: "pirates", name: "Pigskin Pirates", organization: ORG },
});

test("isNoStatsTeamName recognises twins, case-insensitively", () => {
    assert.equal(isNoStatsTeamName("Members Only STATS"), true);
    assert.equal(isNoStatsTeamName("Campus Harvest STATS STATS"), true);
    assert.equal(isNoStatsTeamName("darkside stats "), true);
    assert.equal(isNoStatsTeamName("Stats Kings"), false);
    assert.equal(isNoStatsTeamName("GOAT"), false);
    assert.equal(isNoStatsTeamName(""), false);
});

test("a normal stand-in is allowed", () => {
    assert.equal(validateNoStatsTeams(base()), null);
});

test("a STATS twin can't be the stand-in (the 'X STATS STATS' bug)", () => {
    const c = base();
    c.standInTeamDoc = { _id: "t", name: "Campus Harvest STATS", organization: ORG };
    assert.match(validateNoStatsTeams(c), /scrimmage team/);
});

test("a STATS twin can't be the team that showed up", () => {
    const c = base();
    c.realTeamDoc = { _id: "t", name: "Flying Eagle STATS", organization: ORG };
    assert.match(validateNoStatsTeams(c), /can't start a No Stats Game/);
});

test("an existing No Stats Game can't be forfeited into another", () => {
    const c = base();
    c.original.noStatsBothSides = true;
    assert.match(validateNoStatsTeams(c), /already a No Stats Game/);
});

test("placeholder, other-organization, same-team and forfeiting-team stand-ins are rejected", () => {
    const placeholder = base(); placeholder.standInTeamDoc.isPlaceholder = true;
    assert.match(validateNoStatsTeams(placeholder), /placeholder/);

    const otherOrg = base(); otherOrg.standInTeamDoc.organization = "org2";
    assert.match(validateNoStatsTeams(otherOrg), /same organization/);

    const sameTeam = base(); sameTeam.standInTeamDoc = { ...sameTeam.realTeamDoc };
    assert.match(validateNoStatsTeams(sameTeam), /showed up/);

    const forfeiter = base(); forfeiter.standInTeamDoc = { _id: "trojans", name: "Trojans", organization: ORG };
    assert.match(validateNoStatsTeams(forfeiter), /forfeited/);
});
