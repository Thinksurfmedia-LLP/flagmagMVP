// Optional narrowing for GET /api/organizations/[slug]/games. With no params
// the route keeps its original contract (every game, ascending) for the
// mobile app; callers that only need a slice (e.g. xFlag's results ticker)
// can ask for it instead of downloading every game ever played.
// Pure CommonJS so it runs under `node --test`.

const MAX_LIMIT = 500;

function parsePositiveInt(value) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * @param {URLSearchParams} searchParams
 * @returns {{ status: string|null, season: string|null, order: "asc"|"desc", limit: number|null }}
 *   season is a Season id or the literal "default".
 */
function parseGameListQuery(searchParams) {
    const limit = parsePositiveInt(searchParams.get("limit"));
    return {
        status: searchParams.get("status") || null,
        season: searchParams.get("season") || null,
        order: searchParams.get("order") === "desc" ? "desc" : "asc",
        limit: limit === null ? null : Math.min(limit, MAX_LIMIT),
    };
}

/**
 * @param {object[]} games already sorted ascending by date/time; not mutated
 * @param {ReturnType<typeof parseGameListQuery>} query
 * @param {Set<string>|null} leagueIds restrict to these leagues, or null for all
 */
function applyGameListQuery(games, query, leagueIds) {
    let out = games.filter((g) =>
        (!query.status || g.status === query.status) &&
        (!leagueIds || leagueIds.has(String(g.league)))
    );
    if (query.order === "desc") out = out.reverse();
    if (query.limit !== null) out = out.slice(0, query.limit);
    return out;
}

module.exports = { parseGameListQuery, applyGameListQuery, MAX_LIMIT };
