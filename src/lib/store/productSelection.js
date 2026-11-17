// Pure product-page selection helpers (colour, size, qty, ship copy).
// CommonJS with relative requires so they run under `node --test`.

const { sortSizes } = require("./catalogQuery.js");

const MAX_QTY = 99;
const SELECT_A_SIZE = "Select a size";
const SHIP_READY = "Ships in 3–5 business days";
const PICK_READY = "Pick up details at checkout";

const unique = (values) => [...new Set(values.filter(Boolean))];
const first = (raw) => (Array.isArray(raw) ? raw[0] : raw);
const inStock = (variant) => Boolean(variant) && variant.stock > 0;

/** @returns {{ colors: string[], sizes: string[] }} */
function optionsOf(variants) {
    const list = Array.isArray(variants) ? variants : [];
    return {
        colors: unique(list.map((v) => v.color)),
        sizes: sortSizes(unique(list.map((v) => v.size))),
    };
}

/** The option equal to `raw` (exact, then case-insensitive), else "". */
function matchOption(options, raw) {
    const value = first(raw);
    if (typeof value !== "string") return "";
    const trimmed = value.trim();
    if (options.includes(trimmed)) return trimmed;
    const lower = trimmed.toLowerCase();
    return options.find((o) => o.toLowerCase() === lower) || "";
}

/** Whole number 1..max; anything else becomes 1. */
function parseQty(raw, max = MAX_QTY) {
    const value = first(raw);
    const text = typeof value === "string" ? value.trim() : "";
    if (!/^\d+$/.test(text)) return 1;
    return Math.min(Math.max(Number(text), 1), max);
}

function findVariant(variants, color, size) {
    const list = Array.isArray(variants) ? variants : [];
    return list.find((v) => (v.color || "") === color && (v.size || "") === size) || null;
}

function pickColor(variants, colors, size) {
    const hasStock = (color) =>
        size ? inStock(findVariant(variants, color, size)) : variants.some((v) => v.color === color && inStock(v));
    return colors.find(hasStock) || colors.find((c) => variants.some((v) => v.color === c && inStock(v))) || colors[0];
}

/**
 * Initial colour/size/qty for the product page from `?color=&size=&qty=`.
 * No size is chosen unless the query names one that is in stock.
 * @param {object[]} variants
 * @param {{ color?: unknown, size?: unknown, qty?: unknown }} params
 */
function initialSelection(variants, params = {}) {
    const list = Array.isArray(variants) ? variants : [];
    const { colors, sizes } = optionsOf(list);
    let size = matchOption(sizes, params.size);
    let color = matchOption(colors, params.color);
    if (colors.length && !color) color = pickColor(list, colors, size);
    if (size && !inStock(findVariant(list, color, size))) size = "";
    return { color, size, qty: parseQty(params.qty) };
}

/** Ship / Pick Up `<p>` copy: template text until a size is chosen. */
function shipCopy(isSizeChosen) {
    return isSizeChosen ? { ship: SHIP_READY, pick: PICK_READY } : { ship: SELECT_A_SIZE, pick: SELECT_A_SIZE };
}

module.exports = { optionsOf, matchOption, parseQty, findVariant, initialSelection, shipCopy, MAX_QTY };
