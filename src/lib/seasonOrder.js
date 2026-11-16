// Chronological order for season names like "Fall 2024". Pure CommonJS so it
// runs under `node --test`.

// Order within a year ("Winter 2024" < "Summer 2024" < "Fall 2024" <
// "Holiday 2024"); names without a known term sort after them.
const SEASON_TERMS = ["winter", "spring", "summer", "fall", "holiday"];

/** @param {string} name @returns {number} sortable key, e.g. 20243 for "Fall 2024" */
function seasonSortKey(name) {
    const text = String(name || "").toLowerCase();
    const year = Number((text.match(/\d{4}/) || [0])[0]);
    const term = SEASON_TERMS.findIndex((t) => text.includes(t));
    return year * 10 + (term === -1 ? SEASON_TERMS.length : term);
}

module.exports = { seasonSortKey };
