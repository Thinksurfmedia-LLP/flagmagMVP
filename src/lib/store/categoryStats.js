// Pure per-category summary for the "Shop by Activity" tiles. CommonJS for `node --test`.
const { discountPercent } = require("./pricing");

/**
 * @param {{ category: any, price: number, compareAtPrice?: number|null, images?: string[] }[]} products
 *   active products, newest first
 * @returns {Map<string, { minPrice: number, bestDiscountPercent: number|null, coverImage: string|null }>}
 *   keyed by String(category)
 */
function summarizeByCategory(products) {
    const out = new Map();
    for (const p of products) {
        const key = String(p.category);
        const percent = discountPercent(p.price, p.compareAtPrice ?? null);
        const cover = p.images && p.images[0] ? p.images[0] : null;
        const prev = out.get(key);
        if (!prev) {
            out.set(key, { minPrice: p.price, bestDiscountPercent: percent, coverImage: cover });
            continue;
        }
        out.set(key, {
            minPrice: Math.min(prev.minPrice, p.price),
            bestDiscountPercent:
                percent === null ? prev.bestDiscountPercent : Math.max(prev.bestDiscountPercent ?? 0, percent),
            coverImage: prev.coverImage || cover,
        });
    }
    return out;
}

module.exports = { summarizeByCategory };
