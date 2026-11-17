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
