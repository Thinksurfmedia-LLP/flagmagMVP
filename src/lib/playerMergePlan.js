// Pure rules for "merge player records into one player" (lib/playerMerge.js
// does the database work). CommonJS so it runs under `node --test`.

const MAX_MERGE_SOURCES = 200;

// Names the old-site import gave players it only knew by jersey number:
// "<Team> #<jersey> (<Season>)" (see lib/sgsImport.js) and "Former player #<id>".
const STAND_IN_NAME_RE = /( #[0-9?]+ \(.+\)$)|(^Former player #)/;

/** @param {unknown} name @returns {boolean} */
function isStandInName(name) {
    return STAND_IN_NAME_RE.test(String(name || ""));
}

const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

// Order of a season name within its year ("Winter 2024" < "Summer 2024" <
// "Fall 2024" < "Holiday 2024"); unknown names sort after them.
const SEASON_TERMS = ["winter", "spring", "summer", "fall", "holiday"];

/** @param {string} name @returns {number} sortable key, e.g. 20243 for "Fall 2024" */
function seasonSortKey(name) {
    const text = String(name || "").toLowerCase();
    const year = Number((text.match(/\d{4}/) || [0])[0]);
    const term = SEASON_TERMS.findIndex((t) => text.includes(t));
    return year * 10 + (term === -1 ? SEASON_TERMS.length : term);
}

/**
 * Normalize and validate a merge request.
 * @param {unknown} targetId
 * @param {unknown} sourceIds
 * @returns {{ ok: true, targetId: string, sourceIds: string[] } | { ok: false, error: string }}
 */
function parseMergeRequest(targetId, sourceIds) {
    const target = String(targetId || "");
    if (!OBJECT_ID_RE.test(target)) return { ok: false, error: "Invalid player" };
    if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
        return { ok: false, error: "Choose at least one player record to merge" };
    }
    const unique = [...new Set(sourceIds.map((id) => String(id || "")))];
    if (unique.some((id) => !OBJECT_ID_RE.test(id))) return { ok: false, error: "Invalid player record in the list" };
    if (unique.includes(target)) return { ok: false, error: "A player can't be merged into itself" };
    if (unique.length > MAX_MERGE_SOURCES) {
        return { ok: false, error: `Merge at most ${MAX_MERGE_SOURCES} records at a time` };
    }
    return { ok: true, targetId: target, sourceIds: unique };
}

/**
 * Games in which two or more of the records being merged have stats. One
 * person can't have two stat lines in the same game, so these are almost
 * certainly two different people — merging would add their numbers together.
 * @param {Array<{ player: unknown, game: unknown }>} rows
 * @returns {Array<{ game: string, players: string[] }>}
 */
function findSharedGames(rows) {
    const byGame = new Map();
    for (const row of rows) {
        if (!row || !row.game || !row.player) continue;
        const game = String(row.game);
        if (!byGame.has(game)) byGame.set(game, new Set());
        byGame.get(game).add(String(row.player));
    }
    return [...byGame.entries()]
        .filter(([, players]) => players.size > 1)
        .map(([game, players]) => ({ game, players: [...players].sort() }));
}

/**
 * Reasons a merge must not go ahead (empty array = OK).
 * @param {{
 *   target: { _id: unknown, name: string, organization?: unknown } | null,
 *   sources: Array<{ _id: unknown, name: string, organization?: unknown, user?: unknown }>,
 *   missingSourceIds: string[],
 *   rosteredSourceIds: Set<string>,
 * }} input
 * @returns {string[]}
 */
function mergeBlockers({ target, sources, missingSourceIds, rosteredSourceIds }) {
    if (!target) return ["The player to keep no longer exists"];
    const blockers = [];
    if (missingSourceIds.length) {
        blockers.push(`${missingSourceIds.length} of the chosen records no longer exist — reload and try again`);
    }
    const targetOrg = target.organization ? String(target.organization) : "";
    for (const source of sources) {
        const sourceOrg = source.organization ? String(source.organization) : "";
        if (sourceOrg !== targetOrg) {
            blockers.push(`${source.name} belongs to a different organization`);
        }
        if (source.user) {
            blockers.push(`${source.name} has its own login account, so it can't be merged away`);
        }
        if (rosteredSourceIds.has(String(source._id))) {
            blockers.push(`${source.name} is on a current team roster — remove them from the team first`);
        }
    }
    return blockers;
}

module.exports = { MAX_MERGE_SOURCES, STAND_IN_NAME_RE, isStandInName, seasonSortKey, parseMergeRequest, findSharedGames, mergeBlockers };
