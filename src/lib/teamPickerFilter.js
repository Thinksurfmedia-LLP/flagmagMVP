// Search / filter / sort for the "add player to a team" pickers. XFlag has
// ~2,400 teams (many old ones share a name), so the pickers can't just list
// them all. Expects team.leagues[].league populated with name, type and
// season { name } (GET /api/teams, ?fields=picker). Pure CommonJS so it runs
// under `node --test`.

const { seasonSortKey } = require("./seasonOrder");

const TEAM_SCOPES = ["current", "past", "all"];
const TEAM_SORTS = ["name", "name-desc", "newest"];

function leaguesOf(team) {
    return (team.leagues || []).map((m) => m.league).filter((l) => l && typeof l === "object" && l.name);
}

function isCurrent(team) {
    return leaguesOf(team).some((l) => l.type !== "past");
}

function newestSeasonKey(team) {
    return Math.max(0, ...leaguesOf(team).map((l) => seasonSortKey(l.season?.name || l.name)));
}

/** Lowercase text a search matches against: team name, league names, seasons. */
function searchText(team) {
    const parts = [team.name];
    leaguesOf(team).forEach((l) => parts.push(l.name, l.season?.name || ""));
    return parts.join(" ").toLowerCase();
}

function inScope(team, scope) {
    if (scope === "current") return isCurrent(team);
    if (scope === "past") return !isCurrent(team);
    return true;
}

/**
 * Leagues to offer in the league filter for the teams in `scope`, newest
 * season first: [{ id, label }].
 */
function leagueOptions(teams, scope = "all") {
    const byId = new Map();
    (teams || []).filter((t) => !t.isPlaceholder && inScope(t, scope)).forEach((t) => {
        leaguesOf(t).forEach((l) => {
            if (scope === "current" && l.type === "past") return;
            const id = String(l._id);
            if (byId.has(id)) return;
            const season = l.season?.name || "";
            const label = season && !l.name.includes(season) ? `${l.name} (${season})` : l.name;
            byId.set(id, { id, label, key: seasonSortKey(season || l.name) });
        });
    });
    return [...byId.values()]
        .sort((a, b) => b.key - a.key || a.label.localeCompare(b.label))
        .map(({ id, label }) => ({ id, label }));
}

/**
 * @param {object[]} teams
 * @param {{ query?: string, scope?: string, leagueId?: string, sort?: string, excludeIds?: Set<string> }} options
 * @returns {object[]} new array
 */
function filterAndSortTeams(teams, { query = "", scope = "current", leagueId = "", sort = "name", excludeIds = new Set() } = {}) {
    const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (teams || []).filter((t) => {
        if (t.isPlaceholder || excludeIds.has(String(t._id))) return false;
        if (!inScope(t, scope)) return false;
        if (leagueId && !leaguesOf(t).some((l) => String(l._id) === leagueId)) return false;
        if (words.length === 0) return true;
        const text = searchText(t);
        return words.every((w) => text.includes(w));
    });
    const byName = (a, b) => String(a.name).localeCompare(String(b.name));
    // Same-named teams: the most recent one first.
    const byNewest = (a, b) => newestSeasonKey(b) - newestSeasonKey(a);
    if (sort === "name-desc") return matches.sort((a, b) => byName(b, a) || byNewest(a, b));
    if (sort === "newest") return matches.sort((a, b) => byNewest(a, b) || byName(a, b));
    return matches.sort((a, b) => byName(a, b) || byNewest(a, b));
}

module.exports = { TEAM_SCOPES, TEAM_SORTS, filterAndSortTeams, leagueOptions };
