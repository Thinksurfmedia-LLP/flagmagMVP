// Query for Admin → Archive Players: players imported from the old XFlag site
// (Player.legacyArchive) who aren't on a current roster. Pure CommonJS so it
// runs under `node --test`.

const { STAND_IN_NAME_RE } = require("./playerMergePlan");
const { containsRegex } = require("./searchRegex");

const ARCHIVE_KINDS = ["all", "jersey", "named"];

/**
 * @param {{ orgIds: string[] | null, kind?: string, searchRe?: RegExp | null }} input
 *   orgIds: organizations the caller may see (null = every organization).
 *   kind: "jersey" (only a jersey number was known), "named", or "all".
 * @returns {object} Mongo filter
 */
function buildArchiveFilter({ orgIds, kind = "all", searchRe = null }) {
    const filter = { status: "free_agent", legacyArchive: true };
    if (orgIds) filter.organization = { $in: orgIds };
    const nameClauses = [];
    if (searchRe) nameClauses.push({ name: searchRe });
    if (kind === "jersey") nameClauses.push({ name: STAND_IN_NAME_RE });
    if (kind === "named") nameClauses.push({ name: { $not: STAND_IN_NAME_RE } });
    if (nameClauses.length) filter.$and = nameClauses;
    return filter;
}

/**
 * Search text -> case-insensitive "contains" regex (escaped), or null.
 * When the text ends in a jersey number ("Darkside #5"), the number must end
 * there too, so it finds #5 and not #56 / #57 — the search is used to select
 * every season of one jersey at once.
 * @param {unknown} input
 * @returns {RegExp | null}
 */
function archiveSearchRegex(input) {
    const re = containsRegex(input);
    if (!re) return null;
    return /#\d+$/.test(String(input).trim()) ? new RegExp(`${re.source}(?!\\d)`, "i") : re;
}

module.exports = { ARCHIVE_KINDS, buildArchiveFilter, archiveSearchRegex };
