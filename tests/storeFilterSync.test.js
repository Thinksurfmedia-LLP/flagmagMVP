const test = require("node:test");
const assert = require("node:assert/strict");
const { toggleValue, hasActiveFilters, recordPush, reconcileUrl } = require("../src/lib/store/filterSync.js");

const base = { category: null, q: "", colors: [], sizes: [], minPrice: null, maxPrice: null, sort: "newest", page: 1 };

test("toggleValue adds and removes without mutating", () => {
    const list = ["M"];
    assert.deepEqual(toggleValue(list, "L"), ["M", "L"]);
    assert.deepEqual(toggleValue(list, "M"), []);
    assert.deepEqual(list, ["M"]);
});

test("rapid toggles accumulate when each is computed from the latest working query", () => {
    let working = base;
    working = { ...working, sizes: toggleValue(working.sizes, "M") };
    working = { ...working, sizes: toggleValue(working.sizes, "L") };
    assert.deepEqual(working.sizes, ["M", "L"]);
});

test("hasActiveFilters ignores sort and page", () => {
    assert.equal(hasActiveFilters({ ...base, sort: "name", page: 3 }), false);
    assert.equal(hasActiveFilters({ ...base, category: "jerseys" }), true);
    assert.equal(hasActiveFilters({ ...base, sizes: ["M"] }), true);
    assert.equal(hasActiveFilters({ ...base, minPrice: 0 }), true);
    assert.equal(hasActiveFilters({ ...base, q: "hood" }), true);
});

test("an intermediate arrival keeps the working query; the latest push is adopted", () => {
    let inFlight = recordPush([], "size=M", "");
    inFlight = recordPush(inFlight, "size=M&size=L", "");
    const first = reconcileUrl(inFlight, "size=M");
    assert.equal(first.adopt, false);
    const last = reconcileUrl(first.inFlight, "size=M&size=L");
    assert.equal(last.adopt, true);
    assert.deepEqual(last.inFlight, []);
});

test("a URL we did not push (back/forward, clear) is adopted and clears pending pushes", () => {
    const inFlight = recordPush([], "size=M", "");
    assert.deepEqual(reconcileUrl(inFlight, "category=x"), { adopt: true, inFlight: [] });
});

test("pushing the URL already shown with nothing pending records nothing", () => {
    assert.deepEqual(recordPush([], "size=M", "size=M"), []);
    assert.deepEqual(recordPush(["size=M"], "", ""), ["size=M", ""]);
});
