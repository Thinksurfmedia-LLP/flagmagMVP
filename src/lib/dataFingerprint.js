// Cheap change detection for fingerprintCache: row count + latest updatedAt
// for a filtered collection, returned as one tiny aggregate document instead
// of the documents themselves. Any add/edit/delete through Mongoose (all the
// fingerprinted models use timestamps) changes the result.

const COUNT_AND_LATEST = { _id: null, n: { $sum: 1 }, u: { $max: "$updatedAt" } };

/** @returns {string} e.g. "3528@1760000000000", or "0" for no rows */
function formatPart(row) {
    return row ? `${row.n}@${row.u ? new Date(row.u).getTime() : ""}` : "0";
}

/**
 * Fingerprint of `Model` rows matching `match`. `match` goes to $match
 * as-is (aggregate doesn't cast), so pass real ObjectIds, not strings.
 * @param {import("mongoose").Model} Model
 * @param {object} match
 * @param {object} [extraGroup] extra $group accumulators, returned on `row`
 * @returns {Promise<{ part: string, row: object | undefined }>}
 */
export async function fingerprintOf(Model, match, extraGroup = {}) {
    const [row] = await Model.aggregate([{ $match: match }, { $group: { ...COUNT_AND_LATEST, ...extraGroup } }]);
    return { part: formatPart(row), row };
}
