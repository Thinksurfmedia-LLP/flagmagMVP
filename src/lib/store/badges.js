// Pure storefront badge helpers. CommonJS so they run under `node --test`.

const NEW_BADGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const SIZE_LABELS = {
    XS: "Extra Small",
    S: "Small",
    M: "Medium",
    L: "Large",
    XL: "Extra Large",
    XXL: "2X Large",
    "3XL": "3X Large",
};

/**
 * Whether a product shows the NEW badge. `on`/`off` override; `auto` (default)
 * is true when the product is strictly fewer than NEW_BADGE_DAYS days old.
 */
function isNewProduct(product, now = new Date()) {
    const mode = product && product.newBadge;
    if (mode === "on") return true;
    if (mode === "off") return false;
    const created = product && product.createdAt ? new Date(product.createdAt).getTime() : NaN;
    if (Number.isNaN(created)) return false;
    return now.getTime() - created < NEW_BADGE_DAYS * DAY_MS;
}

function sizeLabel(size) {
    if (typeof size !== "string") return size;
    const key = size.trim().toUpperCase();
    return Object.hasOwn(SIZE_LABELS, key) ? SIZE_LABELS[key] : size;
}

/** Photo for a colour: its mapped image (case-insensitive), else the first image, else "". */
function colorImageFor(product, color) {
    const fallback = (product && Array.isArray(product.images) && product.images[0]) || "";
    const key = typeof color === "string" ? color.trim().toLowerCase() : "";
    const list = product && Array.isArray(product.colorImages) ? product.colorImages : [];
    if (!key) return fallback;
    const hit = list.find((e) => e && typeof e.color === "string" && e.color.trim().toLowerCase() === key);
    return (hit && hit.image) || fallback;
}

/** Card / wishlist / product-page sub-heading: the subtitle, else the short description, else "". */
function cardSubtitle(product) {
    return (product && (product.subtitle || product.shortDescription)) || "";
}

module.exports = { isNewProduct, sizeLabel, colorImageFor, cardSubtitle, NEW_BADGE_DAYS };
