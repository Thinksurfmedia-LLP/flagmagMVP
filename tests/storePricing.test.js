const test = require("node:test");
const assert = require("node:assert/strict");
const { discountPercent, formatPrice, stockState } = require("../src/lib/store/pricing.js");

test("discountPercent", () => {
    assert.equal(discountPercent(99, 129), 23);
    assert.equal(discountPercent(50, 100), 50);
    assert.equal(discountPercent(100, 100), null);
    assert.equal(discountPercent(100, null), null);
});

test("formatPrice", () => {
    assert.equal(formatPrice(45), "$45");
    assert.equal(formatPrice(45.5), "$45.50");
});

test("stockState", () => {
    assert.deepEqual(stockState([{ stock: 0 }, { stock: 0 }]), { state: "out", total: 0 });
    assert.deepEqual(stockState([{ stock: 2 }, { stock: 3 }]), { state: "low", total: 5 });
    assert.deepEqual(stockState([{ stock: 6 }]), { state: "in_stock", total: 6 });
    assert.deepEqual(stockState([]), { state: "out", total: 0 });
});
