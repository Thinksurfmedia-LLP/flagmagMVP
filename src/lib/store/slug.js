// Pure slug helpers for store product URLs. CommonJS with relative requires
// only, so they run under `node --test` without the Next.js resolver.

const MAX_SLUG_LENGTH = 80;

/**
 * Turn a product name into a URL-safe slug.
 * @param {string} text
 * @returns {string} lowercase a-z0-9 segments joined by "-", "" if nothing usable
 */
function slugify(text) {
    return String(text)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, MAX_SLUG_LENGTH)
        .replace(/^-+|-+$/g, "");
}

/**
 * Pick the first free slug: `base`, then `base-2`, `base-3`, ...
 * @param {string} base
 * @param {Set<string>} taken
 * @returns {string}
 */
function nextFreeSlug(base, taken) {
    if (!taken.has(base)) {
        return base;
    }

    let suffix = 2;
    while (taken.has(`${base}-${suffix}`)) {
        suffix += 1;
    }
    return `${base}-${suffix}`;
}

module.exports = { slugify, nextFreeSlug, MAX_SLUG_LENGTH };
