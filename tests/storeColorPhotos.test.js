const test = require("node:test");
const assert = require("node:assert/strict");
const { distinctColors, pruneColorImages } = require("../src/lib/store/colorPhotos.js");

const variants = [{ color: "Black" }, { color: "black " }, { color: "Blue" }, { color: "" }];
const map = [{ color: "Black", image: "/a.jpg" }, { color: "Blue", image: "/b.jpg" }];

test("distinctColors dedupes case-insensitively and skips blanks", () => {
    assert.deepEqual(distinctColors(variants), ["Black", "Blue"]);
});
test("removed image drops its mapping", () => {
    assert.deepEqual(pruneColorImages(map, variants, ["/a.jpg"]), [map[0]]);
});
test("recasing a colour keeps the mapping", () => {
    assert.deepEqual(pruneColorImages(map, [{ color: "BLACK" }, { color: "blue" }], ["/a.jpg", "/b.jpg"]), map);
});
test("colour removed from all variants drops its mapping", () => {
    assert.deepEqual(pruneColorImages(map, [{ color: "Blue" }], ["/a.jpg", "/b.jpg"]), [map[1]]);
});
