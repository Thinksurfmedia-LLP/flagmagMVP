// Query parsing for GET /api/organizations/[slug]/leagues.
// Pure CommonJS so it runs under `node --test`.

const OBJECT_ID_RE = /^[0-9a-f]{24}$/i;

/**
 * ?season= value: "default", a lowercase 24-hex season id, or null when the
 * param is absent or not a season id (the route then ignores it and returns
 * every league, as it did before ids were accepted).
 * @param {string|null} value
 * @returns {string|null}
 */
function normalizeSeasonParam(value) {
    if (value === "default") return "default";
    return typeof value === "string" && OBJECT_ID_RE.test(value) ? value.toLowerCase() : null;
}

module.exports = { normalizeSeasonParam };
