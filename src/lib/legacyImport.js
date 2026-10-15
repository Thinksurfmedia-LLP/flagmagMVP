// Pure mapping rules for importing seasons from the legacy XFlag (Laravel /
// MySQL) system into FlagMag. CommonJS + dependency-free so it runs under
// `node --test`; the DB-facing importer is scripts/legacy/import-season.mjs.
//
// Legacy concepts → FlagMag:
//   season               → Season
//   location (per season) → League (an "X Playoffs" location → leagueType "playoffs")
//   team (one row per season, e.g. "D1 #2 Mountain Goats F25") → one persistent Team
//   sgs_games            → Game (scores copied as-is)
//   stats (per player per game totals) → ImportedStatLine

// Season tags: F25, S24, W25, H25 (holiday), X23 (Christmas), SP25 (spring).
const SEASON_TAG = "(?:SP|[FSWHX])\\d{2}";
const SEASON_TAG_PREFIX = new RegExp(`^${SEASON_TAG}\\s+`, "i"); // "W23 #1 Goblins"
const SEASON_TAG_SUFFIX = new RegExp(`\\s+${SEASON_TAG}$`, "i"); // "Goblins F25"
const SEASON_TAG_BEFORE_QUALIFIER = new RegExp(`\\s+${SEASON_TAG}(?=\\s+-\\s+)`, "i"); // "RawDawgs W25 - Oside"
// Seed prefixes: "D1 #2 ", "D-1 Championship #1 ", "D-2 #3 ", "#3 ".
const SEED_PREFIX = /^(?:(D-?\d+)\s*(?:Championship\s*)?)?#\s*(\d+)\s+/i;
const SEED_SUFFIX = /\s+#\s*(\d+)$/; // "Code Yellow F22 #1"
const STAT_GAME_SUFFIX = /\s+STAT\s+GAME$/i; // stand-in team for a forfeited opponent

function cleanTeamName(name) {
    let n = String(name || "").trim().replace(/\s+/g, " ");
    const isStatGame = STAT_GAME_SUFFIX.test(n);
    n = n.replace(STAT_GAME_SUFFIX, "");
    n = n.replace(SEASON_TAG_PREFIX, "");
    n = n.replace(SEED_PREFIX, "");
    n = n.replace(SEED_SUFFIX, "");
    n = n.replace(SEASON_TAG_SUFFIX, "");
    n = n.replace(SEASON_TAG_BEFORE_QUALIFIER, "");
    n = n.trim();
    // FlagMag names these "<Team> STATS" (see noStatsTeams.js).
    return isStatGame ? `${n} STATS` : n;
}

function teamMatchKey(name) {
    return cleanTeamName(name).toLowerCase();
}

// Fallback key for near-identical spellings of the same club across the two
// systems ("DouxBoyz" vs "Doux Boys", "Bring It" vs "BringIt"): ignores
// spacing/punctuation and treats a word-final "z" as "s" (Boyz/Boys).
function teamLooseKey(name) {
    return cleanTeamName(name).toLowerCase().replace(/z\b/g, "s").replace(/[^a-z0-9]/g, "");
}

function parseSeed(name) {
    const n = String(name || "").trim().replace(/\s+/g, " ").replace(SEASON_TAG_PREFIX, "");
    const m = n.match(SEED_PREFIX);
    if (m) return { division: (m[1] || "").replace("-", "").toUpperCase(), seedNumber: Number(m[2]) };
    const s = n.match(SEED_SUFFIX);
    if (s) return { division: "", seedNumber: Number(s[1]) };
    return { division: "", seedNumber: null };
}

// Cash Counties events are bracket tournaments; the current system already
// files them as playoffs (e.g. "CASH COUNTIES XXIII!!!").
function leagueTypeFor(locationName) {
    return /playoff|cash counties/i.test(locationName) ? "playoffs" : "league";
}

function baseLocationName(locationName) {
    return String(locationName || "")
        .replace(/\s*\(?playoffs?\)?\s*$/i, "")
        .trim();
}

function categoryFor(locationName) {
    if (/women/i.test(locationName)) return "Women";
    if (/beverly|youth/i.test(locationName)) return "Youth";
    return "Men";
}

function formatWeekDate(isoDate) {
    const [y, m, d] = isoDate.split("-").map(Number);
    return `${m}/${d}/${String(y).slice(-2)}`;
}

/**
 * The old site treated every distinct game date as one week. Returns
 * [{ name: "Week N - M/D/YY", date, games: [...] }] sorted by date, games by time.
 */
function groupGamesIntoWeeks(games) {
    const byDate = new Map();
    for (const g of games) {
        if (!byDate.has(g.date)) byDate.set(g.date, []);
        byDate.get(g.date).push(g);
    }
    return [...byDate.keys()]
        .sort()
        .map((date, i) => ({
            name: `Week ${i + 1} - ${formatWeekDate(date)}`,
            date,
            games: byDate.get(date).slice().sort((a, b) => String(a.time).localeCompare(String(b.time))),
        }));
}

function sideForStat(game, sldtId) {
    const id = Number(sldtId);
    if (id === Number(game.sldt_id1)) return "A";
    if (id === Number(game.sldt_id2)) return "B";
    return null;
}

function normalizePersonName(name) {
    return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

module.exports = {
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
};
