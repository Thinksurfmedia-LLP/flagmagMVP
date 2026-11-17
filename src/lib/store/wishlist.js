// Wishlist core (pure, CommonJS for `node --test`) plus a guarded localStorage adapter.

const { MAX_SLUG_LENGTH } = require("./slug.js");

const STORAGE_KEY = "flagmag.wishlist.v1";
const CHANGE_EVENT = "wishlist:change";
const MAX_ITEMS = 100;
const API_SLUG_LIMIT = 50;
const SLUG_RE = new RegExp(`^[a-z0-9-]{1,${MAX_SLUG_LENGTH}}$`);

const text = (v) => (typeof v === "string" ? v.trim() : "");
const lower = (v) => text(v).toLowerCase();
const sameVariant = (a, slug, size, color) =>
    a.slug === slug && lower(a.size) === lower(size) && lower(a.color) === lower(color);

function addItem(list, item, now = Date.now()) {
    const current = Array.isArray(list) ? list : [];
    const slug = item && typeof item.slug === "string" ? item.slug : "";
    if (!SLUG_RE.test(slug)) return [...current];
    const size = text(item.size);
    const color = text(item.color);
    if (current.some((i) => sameVariant(i, slug, size, color))) return [...current];
    return [...current, { slug, size, color, addedAt: now }].slice(-MAX_ITEMS);
}

function removeItem(list, slug, size = "", color = "") {
    return (Array.isArray(list) ? list : []).filter((i) => !sameVariant(i, slug, size, color));
}

function hasItem(list, slug) {
    return Array.isArray(list) && list.some((i) => i.slug === slug);
}

/** Corrupt, non-array or invalid input yields []. Keeps the newest MAX_ITEMS. */
function parseStored(raw) {
    let data;
    try {
        data = JSON.parse(raw);
    } catch {
        return [];
    }
    if (!Array.isArray(data)) return [];
    let out = [];
    for (const entry of data) {
        if (!entry || typeof entry !== "object") continue;
        const addedAt = Number.isFinite(entry.addedAt) ? entry.addedAt : 0;
        out = addItem(out, entry, addedAt);
    }
    return out;
}

/** Splits into arrays of at most `size` (the API accepts <= 50 slugs per request). */
function chunk(values, size = API_SLUG_LIMIT) {
    const out = [];
    for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
    return out;
}

/**
 * Drops only items whose slug was requested but not returned. Slugs that were never
 * requested (e.g. added in another tab mid-fetch) are kept.
 */
function pruneMissing(current, requested, returned) {
    const asked = new Set(requested);
    const found = new Set(returned);
    return (Array.isArray(current) ? current : []).filter((i) => !asked.has(i.slug) || found.has(i.slug));
}

function readWishlist() {
    try {
        return parseStored(window.localStorage.getItem(STORAGE_KEY));
    } catch {
        return [];
    }
}

function writeWishlist(list) {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
        // Storage unavailable (private mode / quota): the in-memory UI still updates below.
    }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: list }));
}

module.exports = {
    addItem, removeItem, hasItem, parseStored, chunk, pruneMissing, readWishlist, writeWishlist,
    STORAGE_KEY, CHANGE_EVENT, MAX_ITEMS,
};
