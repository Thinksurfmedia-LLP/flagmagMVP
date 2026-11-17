const test = require("node:test");
const assert = require("node:assert/strict");
const { summarizeByCategory } = require("../src/lib/store/categoryStats");

test("summarises lowest price, best discount and first available cover per category", () => {
    const m = summarizeByCategory([
        { category: "a", price: 30, compareAtPrice: null, images: [] },
        { category: "a", price: 25, compareAtPrice: 50, images: ["/x.jpg"] },
        { category: "a", price: 40, compareAtPrice: 50, images: ["/y.jpg"] },
        { category: "b", price: 10, images: ["/b.jpg"] },
    ]);
    assert.deepEqual(m.get("a"), { minPrice: 25, bestDiscountPercent: 50, coverImage: "/x.jpg" });
    assert.deepEqual(m.get("b"), { minPrice: 10, bestDiscountPercent: null, coverImage: "/b.jpg" });
});

test("returns an empty map for no products", () => {
    assert.equal(summarizeByCategory([]).size, 0);
});
