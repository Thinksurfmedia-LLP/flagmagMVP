const test = require("node:test");
const assert = require("node:assert/strict");
const { slugify, nextFreeSlug } = require("../src/lib/store/slug.js");

test("slugify normalizes names", () => {
    assert.equal(slugify("Customized Tackle Twill Jerseys!"), "customized-tackle-twill-jerseys");
    assert.equal(slugify("  5 & 8 Men  "), "5-8-men");
    assert.equal(slugify("***"), "");
    assert.equal(slugify("a".repeat(200)).length, 80);
});

test("nextFreeSlug suffixes collisions", () => {
    assert.equal(nextFreeSlug("hoodie", new Set()), "hoodie");
    assert.equal(nextFreeSlug("hoodie", new Set(["hoodie"])), "hoodie-2");
    assert.equal(nextFreeSlug("hoodie", new Set(["hoodie", "hoodie-2"])), "hoodie-3");
});
