// Pure pricing and stock helpers for store products and variants.
// CommonJS with relative requires only, so they run under `node --test`.

const LOW_STOCK_THRESHOLD = 5;

/**
 * Percent off versus a compare-at price, rounded to a whole number.
 * @param {number} price
 * @param {number|null} compareAt
 * @returns {number|null} null unless compareAt is greater than price
 */
function discountPercent(price, compareAt) {
    if (compareAt === null || compareAt === undefined || compareAt <= price) {
        return null;
    }
    return Math.round(((compareAt - price) / compareAt) * 100);
}

/**
 * Display a USD amount: "$45" for whole dollars, "$45.50" otherwise.
 * @param {number} n
 * @returns {string}
 */
function formatPrice(n) {
    return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

/**
 * Aggregate variant stock into a single display state.
 * @param {{ stock: number }[]} variants
 * @returns {{ state: "in_stock"|"low"|"out", total: number }}
 */
function stockState(variants) {
    const total = variants.reduce((sum, variant) => sum + variant.stock, 0);

    if (total === 0) {
        return { state: "out", total };
    }
    if (total <= LOW_STOCK_THRESHOLD) {
        return { state: "low", total };
    }
    return { state: "in_stock", total };
}

module.exports = { discountPercent, formatPrice, stockState, LOW_STOCK_THRESHOLD };
