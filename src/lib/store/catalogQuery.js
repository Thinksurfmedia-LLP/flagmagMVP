// Parses the public /store query string into a safe Mongo filter/sort/page,
// and builds filter links back. Pure CommonJS so it runs under `node --test`.

const { normalize, containsRegex, exactRegex } = require("../searchRegex.js");

const PAGE_SIZE = 12;
const MAX_PAGE = 500;
const MAX_LIST_ITEMS = 10;
const MAX_VALUE_LENGTH = 40;
const CATEGORY_RE = /^[a-z0-9-]{1,80}$/;
const SORTS = {
    newest: { createdAt: -1, _id: 1 },
    "price-asc": { price: 1, _id: 1 },
    "price-desc": { price: -1, _id: 1 },
    name: { name: 1, _id: 1 },
};
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];

function getAll(params, key) {
    if (params instanceof URLSearchParams) return params.getAll(key);
    const value = params ? params[key] : undefined;
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
}

function getFirst(params, key) {
    const [first] = getAll(params, key);
    return typeof first === "string" ? first : null;
}

function parseList(params, key) {
    const seen = new Set();
    for (const raw of getAll(params, key)) {
        if (typeof raw !== "string") continue;
        const value = raw.trim();
        if (value === "" || value.length > MAX_VALUE_LENGTH) continue;
        seen.add(value);
        if (seen.size >= MAX_LIST_ITEMS) break;
    }
    return [...seen];
}

function parsePrice(raw) {
    if (raw === null || raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

function parsePage(raw) {
    const n = Number(raw);
    if (raw === null || !Number.isInteger(n) || n < 1) return 1;
    return Math.min(n, MAX_PAGE);
}

function parseCatalogQuery(params) {
    const categoryRaw = getFirst(params, "category");
    const sortRaw = getFirst(params, "sort");
    let minPrice = parsePrice(getFirst(params, "min"));
    let maxPrice = parsePrice(getFirst(params, "max"));
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
        [minPrice, maxPrice] = [maxPrice, minPrice];
    }
    return {
        category: categoryRaw !== null && CATEGORY_RE.test(categoryRaw) ? categoryRaw : null,
        colors: parseList(params, "color"),
        sizes: parseList(params, "size"),
        minPrice,
        maxPrice,
        q: normalize(getFirst(params, "q")),
        sort: Object.hasOwn(SORTS, sortRaw) ? sortRaw : "newest",
        page: parsePage(getFirst(params, "page")),
    };
}

function buildCatalogFilter(query, opts = {}) {
    const filter = {};
    if (!opts.includeDrafts) filter.status = "active";
    if (opts.categoryId) filter.category = opts.categoryId;

    const re = containsRegex(query.q);
    if (re) filter.$or = [{ name: re }, { tags: re }];

    const price = {};
    if (query.minPrice !== null) price.$gte = query.minPrice;
    if (query.maxPrice !== null) price.$lte = query.maxPrice;
    if (Object.keys(price).length > 0) filter.price = price;

    const elemMatch = {};
    if (query.colors.length > 0) elemMatch.color = { $in: query.colors.map(exactRegex) };
    if (query.sizes.length > 0) elemMatch.size = { $in: query.sizes.map(exactRegex) };
    if (Object.keys(elemMatch).length > 0) filter.variants = { $elemMatch: elemMatch };

    return {
        filter,
        sort: { ...SORTS[query.sort] },
        skip: (query.page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
    };
}

function toQueryString(query, overrides = {}) {
    const next = { ...query, ...overrides };
    if (!("page" in overrides)) next.page = 1;
    const out = new URLSearchParams();
    if (next.category) out.set("category", next.category);
    if (next.q) out.set("q", next.q);
    for (const c of next.colors) out.append("color", c);
    for (const s of next.sizes) out.append("size", s);
    if (next.minPrice !== null && next.minPrice !== undefined) out.set("min", String(next.minPrice));
    if (next.maxPrice !== null && next.maxPrice !== undefined) out.set("max", String(next.maxPrice));
    if (next.sort && next.sort !== "newest") out.set("sort", next.sort);
    if (next.page > 1) out.set("page", String(next.page));
    return out.toString();
}

function sortSizes(sizes) {
    const rank = (s) => {
        const i = SIZE_ORDER.indexOf(String(s).toUpperCase());
        return i === -1 ? SIZE_ORDER.length : i;
    };
    return [...sizes].sort((a, b) => rank(a) - rank(b) || String(a).localeCompare(String(b)));
}

module.exports = { parseCatalogQuery, buildCatalogFilter, toQueryString, sortSizes, PAGE_SIZE };
