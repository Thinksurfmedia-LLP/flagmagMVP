const test = require("node:test");
const assert = require("node:assert/strict");
const {
    optionsOf,
    matchOption,
    parseQty,
    findVariant,
    initialSelection,
    shipCopy,
    MAX_QTY,
} = require("../src/lib/store/productSelection.js");

const v = (color, size, stock = 5) => ({ color, size, stock, sku: `${color}-${size}` });
const VARIANTS = [v("Black", "M"), v("Black", "S"), v("Black", "L", 0), v("Blue", "S"), v("Blue", "L")];

test("optionsOf lists unique colours in order and sizes in size order", () => {
    assert.deepEqual(optionsOf(VARIANTS), { colors: ["Black", "Blue"], sizes: ["S", "M", "L"] });
    assert.deepEqual(optionsOf([v("", "")]), { colors: [], sizes: [] });
    assert.deepEqual(optionsOf(undefined), { colors: [], sizes: [] });
});

test("matchOption matches exactly, then case-insensitively, else empty", () => {
    assert.equal(matchOption(["Black", "Blue"], "Blue"), "Blue");
    assert.equal(matchOption(["Black", "Blue"], " blue "), "Blue");
    assert.equal(matchOption(["Black", "Blue"], "Red"), "");
    assert.equal(matchOption(["Black"], undefined), "");
    assert.equal(matchOption(["Black"], ["black", "x"]), "Black");
    assert.equal(matchOption(["Black"], 42), "");
});

test("parseQty clamps to 1..MAX_QTY and ignores junk", () => {
    assert.equal(MAX_QTY, 99);
    assert.equal(parseQty("3"), 3);
    assert.equal(parseQty("0"), 1);
    assert.equal(parseQty("-4"), 1);
    assert.equal(parseQty("500"), 99);
    assert.equal(parseQty("abc"), 1);
    assert.equal(parseQty("2.7"), 1);
    assert.equal(parseQty(undefined), 1);
    assert.equal(parseQty(["4", "9"]), 4);
});

test("findVariant returns the matching variant or null", () => {
    assert.equal(findVariant(VARIANTS, "Blue", "S").sku, "Blue-S");
    assert.equal(findVariant(VARIANTS, "Blue", "M"), null);
    assert.equal(findVariant(undefined, "Blue", "M"), null);
});

test("initialSelection starts with no size and the first in-stock colour", () => {
    assert.deepEqual(initialSelection(VARIANTS, {}), { color: "Black", size: "", qty: 1 });
    const outFirst = [v("Red", "S", 0), v("Green", "S", 2)];
    assert.deepEqual(initialSelection(outFirst, {}), { color: "Green", size: "", qty: 1 });
});

test("initialSelection honours valid query params", () => {
    assert.deepEqual(initialSelection(VARIANTS, { color: "blue", size: "l", qty: "3" }), { color: "Blue", size: "L", qty: 3 });
});

test("initialSelection with only a size picks a colour that has it in stock", () => {
    assert.deepEqual(initialSelection(VARIANTS, { size: "L" }), { color: "Blue", size: "L", qty: 1 });
});

test("initialSelection drops invalid or unavailable options", () => {
    assert.deepEqual(initialSelection(VARIANTS, { color: "Red", size: "XXL", qty: "x" }), { color: "Black", size: "", qty: 1 });
    // L is out of stock for Black, so the size is ignored but the colour is kept.
    assert.deepEqual(initialSelection(VARIANTS, { color: "Black", size: "L" }), { color: "Black", size: "", qty: 1 });
});

test("initialSelection for a product without options", () => {
    assert.deepEqual(initialSelection([v("", "", 3)], { size: "M", color: "Red", qty: "2" }), { color: "", size: "", qty: 2 });
    assert.deepEqual(initialSelection([], {}), { color: "", size: "", qty: 1 });
});

test("initialSelection for colours without sizes", () => {
    const list = [v("Red", "", 0), v("Blue", "", 1)];
    assert.deepEqual(initialSelection(list, {}), { color: "Blue", size: "", qty: 1 });
});

test("shipCopy uses the template copy until a size is chosen", () => {
    assert.deepEqual(shipCopy(false), { ship: "Select a size", pick: "Select a size" });
    assert.deepEqual(shipCopy(true), { ship: "Ships in 3–5 business days", pick: "Pick up details at checkout" });
});
