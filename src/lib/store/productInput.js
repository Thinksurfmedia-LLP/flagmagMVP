// Input validation for store products and categories. Pure CommonJS with
// relative requires only, so it runs under `node --test`.

const { normalizeAmount } = require("../payments/amount.js");
const { slugify } = require("./slug.js");

const MAX_IMAGES = 8;
const MAX_NAME = 120;
const MAX_SHORT = 200;
const MAX_DESCRIPTION = 5000;
const MAX_SUBTITLE = 120;
const MAX_HIGHLIGHT = 200;
const MAX_LONG_TEXT = 5000;
const MAX_TAGS = 10;
const MAX_TAG = 30;
const NEW_BADGE_MODES = ["auto", "on", "off"];
const MAX_VARIANTS = 50;
const MAX_VARIANT_LABEL = 40;
const MAX_SKU = 64;
const MAX_CATEGORY_NAME = 60;
const PRODUCT_STATUSES = ["draft", "active", "archived"];
const IMAGE_PREFIXES = ["/api/uploads/", "/assets/images/"];
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

const fail = (error) => ({ ok: false, error });

function str(value) {
    return typeof value === "string" ? value.trim() : "";
}

const UNSAFE_PATH_RE = /\.\.|\\|%2e/i;

function isAllowedImage(url) {
    return (
        typeof url === "string"
        && !UNSAFE_PATH_RE.test(url)
        && IMAGE_PREFIXES.some((p) => url.startsWith(p) && url.length > p.length)
    );
}

function toInteger(value) {
    if (typeof value === "string" && value.trim() !== "") {
        value = Number(value);
    }
    return Number.isInteger(value) ? value : null;
}

function normalizeImages(raw) {
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_IMAGES) {
        return fail(`Provide 1 to ${MAX_IMAGES} images`);
    }
    const images = raw.map(str);
    if (!images.every(isAllowedImage)) {
        return fail("Image URLs must start with /api/uploads/ or /assets/images/");
    }
    return { ok: true, value: images };
}

function normalizeVariant(raw, productName) {
    if (!raw || typeof raw !== "object") {
        return fail("Invalid variant");
    }
    const size = str(raw.size);
    const color = str(raw.color);
    const colorHex = str(raw.colorHex);
    if (size.length > MAX_VARIANT_LABEL || color.length > MAX_VARIANT_LABEL) {
        return fail(`Variant size and color must be ${MAX_VARIANT_LABEL} characters or fewer`);
    }
    if (colorHex && !HEX_COLOR_RE.test(colorHex)) {
        return fail("colorHex must be empty or #RRGGBB");
    }
    const stock = toInteger(raw.stock);
    if (stock === null || stock < 0) {
        return fail("Stock must be a whole number of 0 or more");
    }
    const explicitSku = str(raw.sku);
    if (explicitSku.length > MAX_SKU) {
        return fail(`SKU is too long (max ${MAX_SKU} characters)`);
    }
    const sku = explicitSku
        || [productName, size, color].map((p) => slugify(p).toUpperCase()).filter(Boolean).join("-");
    return { ok: true, value: { sku, size, color, colorHex, stock } };
}

function normalizeVariants(raw, productName) {
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_VARIANTS) {
        return fail(`Provide 1 to ${MAX_VARIANTS} variants`);
    }
    const variants = [];
    const seenCombos = new Set();
    const seenSkus = new Set();
    for (const item of raw) {
        const r = normalizeVariant(item, productName);
        if (!r.ok) {
            return r;
        }
        const v = r.value;
        const combo = `${v.size.toLowerCase()}\u0000${v.color.toLowerCase()}`;
        if (seenCombos.has(combo)) {
            const first = variants.find((x) => `${x.size.toLowerCase()}\u0000${x.color.toLowerCase()}` === combo);
            return fail(`Duplicate variant: ${[first.size, first.color].filter(Boolean).join(" / ") || "no options"}`);
        }
        if (seenSkus.has(v.sku.toLowerCase())) {
            return fail(`Duplicate SKU: ${v.sku}`);
        }
        seenCombos.add(combo);
        seenSkus.add(v.sku.toLowerCase());
        variants.push(v);
    }
    return { ok: true, value: variants };
}

function normalizeTags(raw) {
    if (raw === undefined || raw === null) {
        return { ok: true, value: [] };
    }
    if (!Array.isArray(raw)) {
        return fail("Tags must be a list");
    }
    const seen = new Set();
    const tags = [];
    for (const item of raw) {
        const tag = str(item);
        if (!tag || seen.has(tag.toLowerCase())) {
            continue;
        }
        if (tag.length > MAX_TAG) {
            return fail(`Each tag must be ${MAX_TAG} characters or fewer`);
        }
        seen.add(tag.toLowerCase());
        tags.push(tag);
    }
    if (tags.length > MAX_TAGS) {
        return fail(`Use at most ${MAX_TAGS} tags`);
    }
    return { ok: true, value: tags };
}

function normalizeColorImages(raw, variants, images) {
    const result = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        return { ok: true, value: result };
    }
    const colorByLower = new Map();
    for (const v of variants) {
        if (v.color) {
            colorByLower.set(v.color.toLowerCase(), v.color);
        }
    }
    for (const [key, value] of Object.entries(raw)) {
        const color = colorByLower.get(key.trim().toLowerCase());
        if (!color) {
            continue;
        }
        const url = str(value);
        if (!images.includes(url)) {
            return fail(`Colour photo for "${color}" must be one of the product images`);
        }
        result[color] = url;
    }
    return { ok: true, value: result };
}

function normalizeTextFields(body) {
    const limits = [
        ["subtitle", MAX_SUBTITLE, "Subtitle"],
        ["highlight", MAX_HIGHLIGHT, "Highlight"],
        ["details", MAX_LONG_TEXT, "Details"],
        ["specsCare", MAX_LONG_TEXT, "Specs & care"],
    ];
    const value = {};
    for (const [field, max, label] of limits) {
        value[field] = str(body[field]);
        if (value[field].length > max) {
            return fail(`${label} must be ${max} characters or fewer`);
        }
    }
    return { ok: true, value };
}

function normalizePrices(body) {
    const price = normalizeAmount(body.price);
    if (!price.ok) {
        return fail(`Price: ${price.error}`);
    }
    let compareAtPrice = null;
    const hasCompare = body.compareAtPrice !== undefined && body.compareAtPrice !== null && body.compareAtPrice !== "";
    if (hasCompare) {
        const compare = normalizeAmount(body.compareAtPrice);
        if (!compare.ok) {
            return fail(`Compare-at price: ${compare.error}`);
        }
        compareAtPrice = compare.value > price.value ? compare.value : null;
    }
    return { ok: true, value: { price: price.value, compareAtPrice } };
}

/**
 * Validate and normalize an admin product body.
 * @param {unknown} body
 * @returns {{ok: true, value: object} | {ok: false, error: string}}
 */
function normalizeProductInput(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return fail("Invalid product");
    }
    const name = str(body.name);
    if (!name || name.length > MAX_NAME) {
        return fail(`Name is required (max ${MAX_NAME} characters)`);
    }
    const category = str(body.category);
    if (!OBJECT_ID_RE.test(category)) {
        return fail("Invalid category");
    }
    const shortDescription = str(body.shortDescription);
    const description = str(body.description);
    if (shortDescription.length > MAX_SHORT) {
        return fail(`Short description must be ${MAX_SHORT} characters or fewer`);
    }
    if (description.length > MAX_DESCRIPTION) {
        return fail(`Description must be ${MAX_DESCRIPTION} characters or fewer`);
    }
    const status = body.status === undefined || body.status === "" ? "draft" : body.status;
    if (!PRODUCT_STATUSES.includes(status)) {
        return fail("Invalid status");
    }

    const images = normalizeImages(body.images);
    if (!images.ok) {
        return images;
    }
    const prices = normalizePrices(body);
    if (!prices.ok) {
        return prices;
    }
    const variants = normalizeVariants(body.variants, name);
    if (!variants.ok) {
        return variants;
    }

    const text = normalizeTextFields(body);
    if (!text.ok) {
        return text;
    }
    const tags = normalizeTags(body.tags);
    if (!tags.ok) {
        return tags;
    }
    const newBadge = body.newBadge === undefined || body.newBadge === "" ? "auto" : body.newBadge;
    if (!NEW_BADGE_MODES.includes(newBadge)) {
        return fail("Invalid new badge setting");
    }
    const colorImages = normalizeColorImages(body.colorImages, variants.value, images.value);
    if (!colorImages.ok) {
        return colorImages;
    }

    return {
        ok: true,
        value: {
            ...text.value,
            tags: tags.value,
            newBadge,
            colorImages: colorImages.value,
            name,
            category,
            shortDescription,
            description,
            images: images.value,
            price: prices.value.price,
            compareAtPrice: prices.value.compareAtPrice,
            variants: variants.value,
            status,
            isFeatured: body.isFeatured === true,
        },
    };
}

/**
 * Validate and normalize an admin category body.
 * @param {unknown} body
 * @returns {{ok: true, value: {name: string, image: string, sortOrder: number}} | {ok: false, error: string}}
 */
function normalizeCategoryInput(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return fail("Invalid category");
    }
    const name = str(body.name);
    if (!name || name.length > MAX_CATEGORY_NAME) {
        return fail(`Name is required (max ${MAX_CATEGORY_NAME} characters)`);
    }
    const image = str(body.image);
    if (image && !isAllowedImage(image)) {
        return fail("Image URL must start with /api/uploads/ or /assets/images/");
    }
    const sortOrder = body.sortOrder === undefined || body.sortOrder === "" ? 0 : toInteger(body.sortOrder);
    if (sortOrder === null) {
        return fail("Sort order must be a whole number");
    }
    return { ok: true, value: { name, image, sortOrder } };
}

module.exports = {
    normalizeProductInput,
    normalizeCategoryInput,
    MAX_IMAGES,
    MAX_NAME,
    MAX_SHORT,
    MAX_DESCRIPTION,
    PRODUCT_STATUSES,
};
