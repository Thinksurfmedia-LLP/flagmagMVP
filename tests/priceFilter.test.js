const test = require("node:test");
const assert = require("node:assert/strict");
const { parsePriceText, mergePendingPrice } = require("../src/lib/store/priceFilter.js");
const { toQueryString } = require("../src/lib/store/catalogQuery.js");

const base = { category: null, q: "", colors: [], sizes: [], minPrice: null, maxPrice: null, sort: "newest", page: 1 };

test("parsePriceText returns null for empty, negative and non-numeric text", () => {
    assert.equal(parsePriceText(""), null);
    assert.equal(parsePriceText("  "), null);
    assert.equal(parsePriceText("-5"), null);
    assert.equal(parsePriceText("abc"), null);
    assert.equal(parsePriceText(" 12.5 "), 12.5);
});

test("mergePendingPrice keeps both pending min and max alongside a newly toggled colour", () => {
    const merged = mergePendingPrice(base, { min: "10", max: "50" });
    const qs = toQueryString(merged, { colors: ["Red"] });
    assert.equal(qs, "color=Red&min=10&max=50");
});

test("mergePendingPrice does not mutate the input query", () => {
    const merged = mergePendingPrice(base, { min: "1", max: "" });
    assert.equal(base.minPrice, null);
    assert.equal(merged.minPrice, 1);
    assert.equal(merged.maxPrice, null);
});
