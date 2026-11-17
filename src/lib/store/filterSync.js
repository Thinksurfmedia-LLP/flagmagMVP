// Pure helpers that keep the store filter sidebar's working query in step with
// the URL while router pushes are still in flight. CommonJS for `node --test`.

const MAX_IN_FLIGHT = 10;

/** Add `value` to `list`, or remove it when present. Returns a new array. */
function toggleValue(list, value) {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** True when any user-facing filter (not sort or page) is applied. */
function hasActiveFilters(query) {
    return Boolean(
        query.category
        || query.q
        || query.tag
        || query.colors.length > 0
        || query.sizes.length > 0
        || (query.minPrice !== null && query.minPrice !== undefined)
        || (query.maxPrice !== null && query.maxPrice !== undefined)
    );
}

/**
 * Remember a query string we just pushed. Skipped when nothing is in flight and
 * the URL already shows it, since no URL change will arrive to clear it.
 */
function recordPush(inFlight, qs, currentQs) {
    if (inFlight.length === 0 && qs === currentQs) return inFlight;
    return [...inFlight.filter((q) => q !== qs), qs].slice(-MAX_IN_FLIGHT);
}

/**
 * The URL changed to `urlQs`. A URL we pushed that is not the latest push is an
 * intermediate state: keep the working query. Anything else (the latest push, or
 * back/forward/Clear filters) is adopted from the URL.
 * @returns {{ adopt: boolean, inFlight: string[] }}
 */
function reconcileUrl(inFlight, urlQs) {
    const index = inFlight.indexOf(urlQs);
    if (index === -1) return { adopt: true, inFlight: [] };
    const rest = inFlight.slice(index + 1);
    return { adopt: rest.length === 0, inFlight: rest };
}

module.exports = { toggleValue, hasActiveFilters, recordPush, reconcileUrl };
