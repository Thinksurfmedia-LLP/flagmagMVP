const test = require("node:test");
const assert = require("node:assert/strict");
const { addItem, removeItem, hasItem, parseStored, MAX_ITEMS } = require("../src/lib/store/wishlist.js");

const item = (slug, size = "", color = "", addedAt = 1) => ({ slug, size, color, addedAt });

test("addItem appends without mutating the input list", () => {
    const list = [];
    const next = addItem(list, { slug: "a", size: "L", color: "Black" }, 5);
    assert.deepEqual(list, []);
    assert.deepEqual(next, [item("a", "L", "Black", 5)]);
});
test("addItem dedupes by slug+size+color, case-insensitive on size/color", () => {
    const list = [item("a", "L", "Black")];
    assert.equal(addItem(list, { slug: "a", size: "l", color: "black" }, 9).length, 1);
    assert.equal(addItem(list, { slug: "a", size: "M", color: "Black" }, 9).length, 2);
    assert.equal(addItem(list, { slug: "b", size: "L", color: "Black" }, 9).length, 2);
});
test("addItem ignores invalid slugs and defaults size/color to empty", () => {
    assert.deepEqual(addItem([], { slug: "BAD!!" }, 1), []);
    assert.deepEqual(addItem([], { slug: "a" }, 1), [item("a", "", "", 1)]);
});
test("addItem caps at MAX_ITEMS keeping the newest", () => {
    let list = [];
    for (let i = 0; i < MAX_ITEMS + 5; i++) list = addItem(list, { slug: `p${i}` }, i);
    assert.equal(list.length, MAX_ITEMS);
    assert.equal(list[0].slug, "p5");
    assert.equal(list[list.length - 1].slug, `p${MAX_ITEMS + 4}`);
});
test("removeItem removes the exact variant only", () => {
    const list = [item("a", "L", "Black"), item("a", "M", "Black"), item("b")];
    assert.deepEqual(removeItem(list, "a", "l", "BLACK").map((i) => i.size), ["M", ""]);
    assert.equal(removeItem(list, "zzz", "", "").length, 3);
});
test("hasItem matches by slug", () => {
    assert.equal(hasItem([item("a", "L")], "a"), true);
    assert.equal(hasItem([item("a")], "b"), false);
    assert.equal(hasItem(null, "a"), false);
});
test("parseStored returns [] for null, corrupt JSON and non-arrays", () => {
    assert.deepEqual(parseStored(null), []);
    assert.deepEqual(parseStored("{nope"), []);
    assert.deepEqual(parseStored('{"a":1}'), []);
    assert.deepEqual(parseStored('"str"'), []);
});
test("parseStored drops invalid entries and dedupes", () => {
    const raw = JSON.stringify([item("a", "L"), null, 5, { slug: 3 }, { slug: "BAD!" }, item("a", "l"), item("b")]);
    assert.deepEqual(parseStored(raw).map((i) => i.slug), ["a", "b"]);
});
test("parseStored caps oversize lists keeping the newest", () => {
    const raw = JSON.stringify(Array.from({ length: MAX_ITEMS + 20 }, (_, i) => item(`p${i}`, "", "", i)));
    const out = parseStored(raw);
    assert.equal(out.length, MAX_ITEMS);
    assert.equal(out[0].slug, "p20");
});
