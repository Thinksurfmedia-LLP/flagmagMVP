const test = require("node:test");
const assert = require("node:assert/strict");
const {
    parseCatalogQuery, buildCatalogFilter, toQueryString, sortSizes, PAGE_SIZE,
} = require("../src/lib/store/catalogQuery.js");

test("junk params fall back safely", () => {
    const q = parseCatalogQuery({ page: "-3", min: "abc", max: "1e999", sort: "drop", category: "../x", color: ["<script>", "Red"] });
    assert.equal(q.page, 1); assert.equal(q.minPrice, null); assert.equal(q.maxPrice, null);
    assert.equal(q.sort, "newest"); assert.equal(q.category, null);
    assert.deepEqual(q.colors, ["<script>", "Red"]);
});
test("swaps inverted price range", () => {
    const q = parseCatalogQuery(new URLSearchParams("min=50&max=10"));
    assert.equal(q.minPrice, 10); assert.equal(q.maxPrice, 50);
});
test("public filter always forces active status", () => {
    assert.equal(buildCatalogFilter(parseCatalogQuery({}), {}).filter.status, "active");
    assert.equal(buildCatalogFilter(parseCatalogQuery({}), { includeDrafts: true }).filter.status, undefined);
});
test("pagination math", () => {
    const { skip, limit } = buildCatalogFilter(parseCatalogQuery({ page: "3" }), {});
    assert.equal(skip, 24); assert.equal(limit, 12); assert.equal(PAGE_SIZE, 12);
});
test("regex text is escaped", () => {
    const { filter } = buildCatalogFilter(parseCatalogQuery({ q: "(a+)+$" }), {});
    assert.equal(filter.name.source, "\\(a\\+\\)\\+\\$");
});
test("toQueryString drops defaults and resets page on filter change", () => {
    const q = parseCatalogQuery({ page: "4", color: "Red" });
    assert.equal(toQueryString(q, { sizes: ["M"] }), "color=Red&size=M");
    assert.equal(toQueryString(q, { page: 5 }), "color=Red&page=5");
});
test("sortSizes", () => assert.deepEqual(sortSizes(["XL", "Youth L", "S", "M"]), ["S", "M", "XL", "Youth L"]));

test("array values take first for single params; page capped; dedupe and caps", () => {
    const q = parseCatalogQuery({
        page: ["9999", "2"], sort: ["price-asc"], q: ["  hat  "], category: ["jerseys"],
        color: ["Red", "Red", "", "x".repeat(41), "Blue"], size: Array.from({ length: 15 }, (_, i) => `S${i}`),
    });
    assert.equal(q.page, 500); assert.equal(q.sort, "price-asc"); assert.equal(q.q, "hat");
    assert.equal(q.category, "jerseys"); assert.deepEqual(q.colors, ["Red", "Blue"]); assert.equal(q.sizes.length, 10);
});
test("negative price is null; empty q is null", () => {
    const q = parseCatalogQuery({ min: "-5", max: "20", q: "   " });
    assert.equal(q.minPrice, null); assert.equal(q.maxPrice, 20); assert.equal(q.q, null);
});
test("filter composition: elemMatch, category, price, sort", () => {
    const q = parseCatalogQuery({ color: "Red", min: "5", max: "9", sort: "price-desc" });
    const r = buildCatalogFilter(q, { categoryId: "abc" });
    assert.equal(r.filter.category, "abc");
    assert.deepEqual(r.filter.price, { $gte: 5, $lte: 9 });
    assert.equal(r.filter.variants.$elemMatch.color.$in[0].source, "^Red$");
    assert.equal("size" in r.filter.variants.$elemMatch, false);
    assert.deepEqual(r.sort, { price: -1, _id: 1 });
    const none = buildCatalogFilter(parseCatalogQuery({}), {});
    assert.equal("variants" in none.filter, false);
    assert.equal("category" in none.filter, false);
    assert.deepEqual(none.sort, { createdAt: -1 });
});
