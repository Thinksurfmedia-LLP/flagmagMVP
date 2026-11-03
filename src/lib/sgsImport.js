// Pure mapping rules for the OLDEST XFlag stats system — the Joomla "SGS"
// component (sgs_* tables, Summer 2008 → Summer 2011). Its data is first
// reshaped into the Laravel-era tables by scripts/legacy/sgs-to-legacy-sqlite.mjs
// so the existing season importer (scripts/legacy/import-season.mjs) can be
// reused unchanged. CommonJS + dependency-free so it runs under `node --test`.
//
// SGS concepts → Laravel-era tables:
//   sgs_season           → seasons
//   sgs_SLDT (season/location/division/team row) → sldt
//   sgs_game             → sgs_games (+ season_id, taken from its SLDT rows)
//   sgs_SLDTP (roster slot: SLDT + player + jersey) → sldtp + players
//   sgs_player ("Last, First") → users
//   sgs_stats            → stats (no rushing / flag-pull columns back then)

// Unnamed roster slots (SGS kept only a jersey number for most players after
// 2008) get user ids above this offset so they never collide with sgs_player ids.
const UNNAMED_USER_OFFSET = 1000000;

/** "Lewis, Michael" → { first: "Michael", last: "Lewis" }; "P,Eddie" → { first: "Eddie", last: "P" }. */
function parseSgsPlayerName(raw) {
    const name = String(raw || "").trim().replace(/\s+/g, " ");
    const comma = name.indexOf(",");
    if (comma === -1) {
        const parts = name.split(" ");
        return { first: parts.slice(0, -1).join(" ") || parts[0] || "", last: parts.length > 1 ? parts[parts.length - 1] : "" };
    }
    return { first: name.slice(comma + 1).trim(), last: name.slice(0, comma).trim() };
}

/**
 * SGS stored kick-off as "900", "1000", "100" with no AM/PM, so the hour is
 * kept as written (zero-padded, "09:00") rather than guessing — weeknight
 * "700" games were evening games while Sunday "700" games were mornings.
 */
function formatSgsTime(raw) {
    const digits = String(raw ?? "").replace(/\D/g, "");
    if (!digits || Number(digits) === 0) return "";
    const padded = digits.padStart(4, "0").slice(-4);
    return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

function seasonSlug(name) {
    return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Display name for a roster slot that only recorded a jersey number. */
function unnamedPlayerName(teamName, jersey, seasonName) {
    const team = String(teamName || "").trim() || "Unknown team";
    const number = jersey === null || jersey === undefined || jersey === "" ? "?" : String(jersey);
    return `${team} #${number} (${String(seasonName || "").trim()})`;
}

module.exports = {
    UNNAMED_USER_OFFSET,
    parseSgsPlayerName,
    formatSgsTime,
    seasonSlug,
    unnamedPlayerName,
};
