// Pure helpers for the store's debounced price inputs. CommonJS for `node --test`.

/** Parse a price input's text to a non-negative number, or null when empty/invalid. */
function parsePriceText(text) {
    const trimmed = String(text ?? "").trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Fold the current (possibly not yet applied) price texts into a query. Returns a new object. */
function mergePendingPrice(query, texts) {
    return { ...query, minPrice: parsePriceText(texts.min), maxPrice: parsePriceText(texts.max) };
}

module.exports = { parsePriceText, mergePendingPrice };
