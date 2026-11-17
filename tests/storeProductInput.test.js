const test = require("node:test");
const assert = require("node:assert/strict");
const {
    normalizeProductInput,
    normalizeCategoryInput,
    MAX_IMAGES,
} = require("../src/lib/store/productInput.js");

function validProduct(overrides = {}) {
    return {
        name: "FlagMag Hoodie",
        category: "6ae8de37e6896bb733f10d4c",
        images: ["/api/uploads/a.png"],
        price: 45,
        variants: [{ size: "M", color: "Black", stock: 3 }],
        status: "active",
        ...overrides,
    };
}

test("accepts a valid product and fills defaults", () => {
    const r = normalizeProductInput(validProduct({ status: undefined, variants: [{ size: "M", color: "Black", stock: 3 }] }));
    assert.equal(r.ok, true);
    assert.equal(r.value.status, "draft");
    assert.equal(r.value.variants[0].sku, "FLAGMAG-HOODIE-M-BLACK");
    assert.equal(r.value.isFeatured, false);
    assert.equal(r.value.compareAtPrice, null);
});

test("rejects 3-decimal price", () => assert.match(normalizeProductInput(validProduct({ price: "12.345" })).error, /2 decimal/));

test("keeps compareAtPrice above price, drops one not above price", () => {
    assert.equal(normalizeProductInput(validProduct({ price: 30, compareAtPrice: 40 })).value.compareAtPrice, 40);
    assert.equal(normalizeProductInput(validProduct({ price: 30, compareAtPrice: 30 })).value.compareAtPrice, null);
    assert.equal(normalizeProductInput(validProduct({ price: 30, compareAtPrice: 20 })).value.compareAtPrice, null);
});

test("rejects negative or fractional stock", () => {
    assert.equal(normalizeProductInput(validProduct({ variants: [{ size: "M", stock: -1 }] })).ok, false);
    assert.equal(normalizeProductInput(validProduct({ variants: [{ size: "M", stock: 2.5 }] })).ok, false);
});

test("rejects duplicate size/color", () => {
    const r = normalizeProductInput(validProduct({ variants: [{ size: "M", color: "Black", stock: 1 }, { size: "m", color: "black", stock: 2 }] }));
    assert.equal(r.error, "Duplicate variant: M / Black");
});

test("rejects duplicate SKU and shows size-only duplicates readably", () => {
    const sku = normalizeProductInput(validProduct({ variants: [
        { sku: "X-1", size: "M", stock: 1 }, { sku: "x-1", size: "L", stock: 1 },
    ] }));
    assert.equal(sku.error, "Duplicate SKU: x-1");
    const sizeOnly = normalizeProductInput(validProduct({ variants: [{ size: "M", stock: 1 }, { size: "m", stock: 1 }] }));
    assert.equal(sizeOnly.error, "Duplicate variant: M");
});

test("rejects foreign or script image URLs", () => {
    for (const url of ["javascript:alert(1)", "https://evil.example/x.png", "//evil.example/x.png"]) {
        assert.equal(normalizeProductInput(validProduct({ images: [url] })).ok, false, url);
    }
});

test("rejects bad category id, empty images, >8 images, missing name", () => {
    assert.equal(normalizeProductInput(validProduct({ category: "nope" })).ok, false);
    assert.equal(normalizeProductInput(validProduct({ images: [] })).ok, false);
    assert.equal(normalizeProductInput(validProduct({ images: Array(MAX_IMAGES + 1).fill("/api/uploads/a.png") })).ok, false);
    assert.equal(normalizeProductInput(validProduct({ name: "   " })).ok, false);
    assert.equal(normalizeProductInput(null).ok, false);
});

test("rejects bad colorHex, bad status, and 0 or >50 variants", () => {
    assert.equal(normalizeProductInput(validProduct({ variants: [{ size: "M", colorHex: "red", stock: 1 }] })).ok, false);
    assert.equal(normalizeProductInput(validProduct({ variants: [{ size: "M", colorHex: "#aabbcc", stock: 1 }] })).ok, true);
    assert.equal(normalizeProductInput(validProduct({ status: "bogus" })).ok, false);
    assert.equal(normalizeProductInput(validProduct({ variants: [] })).ok, false);
    const many = Array.from({ length: 51 }, (_, i) => ({ size: `S${i}`, stock: 1 }));
    assert.equal(normalizeProductInput(validProduct({ variants: many })).ok, false);
});

test("category input", () => {
    assert.deepEqual(normalizeCategoryInput({ name: " Apparel " }).value, { name: "Apparel", image: "", sortOrder: 0 });
    assert.equal(normalizeCategoryInput({ name: "" }).ok, false);
    assert.equal(normalizeCategoryInput({ name: "x".repeat(61) }).ok, false);
    assert.equal(normalizeCategoryInput({ name: "A", image: "https://evil.example/x.png" }).ok, false);
    assert.equal(normalizeCategoryInput({ name: "A", sortOrder: 1.5 }).ok, false);
    assert.equal(normalizeCategoryInput({ name: "A", sortOrder: 3, image: "/assets/images/a.png" }).value.sortOrder, 3);
});

test("allows one no-option variant, rejects a second", () => {
    const r = normalizeProductInput(validProduct({ variants: [{ stock: 4 }] }));
    assert.equal(r.ok, true);
    assert.equal(r.value.variants[0].sku, "FLAGMAG-HOODIE");
    const dup = normalizeProductInput(validProduct({ variants: [{ stock: 1 }, { size: "", color: "", stock: 2 }] }));
    assert.equal(dup.error, "Duplicate variant: no options");
});

test("rejects image URLs with traversal, backslashes or encoded dots", () => {
    for (const url of [
        "/api/uploads/../secret.png",
        "/assets/images/..%2fx.png",
        "/api/uploads/%2e%2e/x.png",
        "/api/uploads/%2Ex.png",
        "/api/uploads/a\\b.png",
    ]) {
        const r = normalizeProductInput(validProduct({ images: [url] }));
        assert.equal(r.ok, false, url);
        assert.match(r.error, /Image URLs must start with/);
    }
    assert.equal(normalizeCategoryInput({ name: "A", image: "/assets/images/../a.png" }).ok, false);
});

test("caps explicit SKU at 64 characters", () => {
    const long = normalizeProductInput(validProduct({ variants: [{ sku: "X".repeat(65), size: "M", stock: 1 }] }));
    assert.equal(long.error, "SKU is too long (max 64 characters)");
    assert.equal(normalizeProductInput(validProduct({ variants: [{ sku: "X".repeat(64), size: "M", stock: 1 }] })).ok, true);
});

test("price errors name the offending field", () => {
    assert.match(normalizeProductInput(validProduct({ price: "12.345" })).error, /^Price: .*2 decimal/);
    assert.match(normalizeProductInput(validProduct({ compareAtPrice: "9.999" })).error, /^Compare-at price: .*2 decimal/);
});

test("new text fields default to empty and are trimmed", () => {
    const r = normalizeProductInput(validProduct({ subtitle: "  Sub  ", highlight: " H ", details: " D ", specsCare: " S " }));
    assert.equal(r.ok, true);
    assert.equal(r.value.subtitle, "Sub");
    assert.equal(r.value.highlight, "H");
    assert.equal(r.value.details, "D");
    assert.equal(r.value.specsCare, "S");
    const d = normalizeProductInput(validProduct());
    assert.equal(d.value.subtitle, "");
    assert.deepEqual(d.value.tags, []);
    assert.equal(d.value.newBadge, "auto");
    assert.deepEqual(d.value.colorImages, []);
});
test("rejects over-long subtitle, highlight, details, specsCare", () => {
    assert.equal(normalizeProductInput(validProduct({ subtitle: "x".repeat(121) })).ok, false);
    assert.equal(normalizeProductInput(validProduct({ subtitle: "x".repeat(120) })).ok, true);
    assert.equal(normalizeProductInput(validProduct({ highlight: "x".repeat(201) })).ok, false);
    assert.equal(normalizeProductInput(validProduct({ highlight: "x".repeat(200) })).ok, true);
    assert.equal(normalizeProductInput(validProduct({ details: "x".repeat(5001) })).ok, false);
    assert.equal(normalizeProductInput(validProduct({ details: "x".repeat(5000) })).ok, true);
    assert.equal(normalizeProductInput(validProduct({ specsCare: "x".repeat(5001) })).ok, false);
    assert.equal(normalizeProductInput(validProduct({ specsCare: "x".repeat(5000) })).ok, true);
});
test("tags are trimmed, deduped case-insensitively, empties dropped", () => {
    const r = normalizeProductInput(validProduct({ tags: [" Flag ", "flag", "FLAG", "Tee", ""] }));
    assert.deepEqual(r.value.tags, ["Flag", "Tee"]);
});
test("tags: more than 10 distinct is an error, tag over 30 chars is an error", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `t${i}`);
    assert.equal(normalizeProductInput(validProduct({ tags: eleven })).ok, false);
    assert.equal(normalizeProductInput(validProduct({ tags: eleven.slice(0, 10) })).ok, true);
    assert.equal(normalizeProductInput(validProduct({ tags: ["x".repeat(31)] })).ok, false);
    assert.equal(normalizeProductInput(validProduct({ tags: ["x".repeat(30)] })).ok, true);
    assert.equal(normalizeProductInput(validProduct({ tags: "nope" })).ok, false);
});
test("newBadge accepts auto/on/off, rejects others", () => {
    for (const v of ["auto", "on", "off"]) {
        assert.equal(normalizeProductInput(validProduct({ newBadge: v })).value.newBadge, v);
    }
    assert.equal(normalizeProductInput(validProduct({ newBadge: "yes" })).ok, false);
});
test("colorImages: value must be one of images, exact error", () => {
    const body = validProduct({
        variants: [{ size: "M", color: "Red", stock: 1 }],
        colorImages: { Red: "/assets/images/other.jpg" },
    });
    const r = normalizeProductInput(body);
    assert.equal(r.ok, false);
    assert.equal(r.error, 'Colour photo for "Red" must be one of the product images');
});
test("colorImages: keys match variant colours case-insensitively and use variant casing; unknown dropped", () => {
    const img = validProduct().images[0];
    const body = validProduct({
        variants: [{ size: "M", color: "Red", stock: 1 }],
        colorImages: { red: img, Blue: img },
    });
    const r = normalizeProductInput(body);
    assert.equal(r.ok, true);
    assert.deepEqual(r.value.colorImages, [{ color: "Red", image: img }]);
});
test("colorImages: array input accepted, deduped (last wins), unknown dropped", () => {
    const [a, b] = validProduct({ images: ["/assets/images/a.jpg", "/assets/images/b.jpg"] }).images;
    const r = normalizeProductInput(validProduct({
        images: [a, b],
        variants: [{ size: "M", color: "Red", stock: 1 }],
        colorImages: [{ color: "red", image: a }, { color: "RED", image: b }, { color: "Pink", image: a }],
    }));
    assert.equal(r.ok, true);
    assert.deepEqual(r.value.colorImages, [{ color: "Red", image: b }]);
});
test("colorImages: invalid shapes are rejected", () => {
    for (const bad of ["x", 5, ["a"], [null], true]) {
        const r = normalizeProductInput(validProduct({ colorImages: bad }));
        assert.equal(r.ok, false);
        assert.equal(r.error, "colorImages must be a list of colour photos");
    }
});
test("colorImages: colour containing a dot works", () => {
    const img = validProduct().images[0];
    const r = normalizeProductInput(validProduct({
        variants: [{ size: "M", color: "St. Patrick Green", stock: 1 }],
        colorImages: { "st. patrick green": img },
    }));
    assert.equal(r.ok, true);
    assert.deepEqual(r.value.colorImages, [{ color: "St. Patrick Green", image: img }]);
});
