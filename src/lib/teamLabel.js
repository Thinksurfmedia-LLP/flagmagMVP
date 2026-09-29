// Human-readable team labels for pickers: "Trojans — SD Thu (Fall 2026)".
//
// Team names are only unique WITHIN a league, not across an organization
// (e.g. XFlagFootball has a Beverly "Trojans" from Spring 2026 and a
// separate SD Thu "Trojans" in Fall 2026). Pickers that showed the bare
// name made those two indistinguishable, and a player got put on the wrong
// one. Expects team.leagues[].league populated with name, type ("active" /
// "past") and season { name } — as GET /api/teams returns it. Pure CommonJS
// so it runs under `node --test`.

const MAX_LEAGUES_SHOWN = 2;

function leagueText(league) {
    const season = league.season?.name;
    // "Beverly Spring 2026" already says its season — don't repeat it.
    return season && !league.name.includes(season) ? `${league.name} (${season})` : league.name;
}

function populatedLeagues(team) {
    return (team.leagues || []).map((m) => m.league).filter((l) => l && typeof l === "object" && l.name);
}

function shorten(parts) {
    if (parts.length <= MAX_LEAGUES_SHOWN) return parts.join(", ");
    return `${parts.slice(0, MAX_LEAGUES_SHOWN).join(", ")} +${parts.length - MAX_LEAGUES_SHOWN} more`;
}

/** "SD Thu (Fall 2026)", "Beverly Spring 2026 (past)", or "no league". */
function teamLeagueSummary(team) {
    const leagues = populatedLeagues(team);
    const current = leagues.filter((l) => l.type !== "past");
    if (current.length > 0) return shorten(current.map(leagueText));
    if (leagues.length > 0) return `${shorten(leagues.map(leagueText))} (past)`;
    return "no league";
}

/** "Trojans — SD Thu (Fall 2026)" */
function teamLabel(team) {
    return `${team.name} — ${teamLeagueSummary(team)}`;
}

function rank(team) {
    const leagues = populatedLeagues(team);
    if (leagues.some((l) => l.type !== "past")) return 0;
    return leagues.length > 0 ? 1 : 2;
}

/** New array: teams in a current league first, then past-only, then none; A–Z within each. */
function sortTeamsForPicker(teams) {
    return [...(teams || [])].sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)));
}

module.exports = { teamLeagueSummary, teamLabel, sortTeamsForPicker };
