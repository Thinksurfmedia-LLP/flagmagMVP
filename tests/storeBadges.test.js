const test = require("node:test");
const assert = require("node:assert/strict");
const { isNewProduct, sizeLabel, colorImageFor, cardSubtitle, NEW_BADGE_DAYS } = require("../src/lib/store/badges.js");

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-17T12:00:00Z");
const ago = (days) => new Date(now.getTime() - days * DAY);

test("NEW_BADGE_DAYS is 30", () => assert.equal(NEW_BADGE_DAYS, 30));
test("auto: 29 days old is new, 30 days is not", () => {
    assert.equal(isNewProduct({ newBadge: "auto", createdAt: ago(29) }, now), true);
    assert.equal(isNewProduct({ newBadge: "auto", createdAt: ago(30) }, now), false);
});
test("auto accepts ISO strings; missing or invalid createdAt is false", () => {
    assert.equal(isNewProduct({ newBadge: "auto", createdAt: ago(1).toISOString() }, now), true);
    assert.equal(isNewProduct({ newBadge: "auto" }, now), false);
    assert.equal(isNewProduct({ newBadge: "auto", createdAt: "nope" }, now), false);
});
test("undefined newBadge behaves as auto", () => {
    assert.equal(isNewProduct({ createdAt: ago(2) }, now), true);
});
test("on and off override age", () => {
    assert.equal(isNewProduct({ newBadge: "on", createdAt: ago(400) }, now), true);
    assert.equal(isNewProduct({ newBadge: "off", createdAt: ago(1) }, now), false);
});
test("sizeLabel maps known sizes case-insensitively and passes others through", () => {
    assert.equal(sizeLabel("XS"), "Extra Small");
    assert.equal(sizeLabel("s"), "Small");
    assert.equal(sizeLabel("M"), "Medium");
    assert.equal(sizeLabel("L"), "Large");
    assert.equal(sizeLabel("xl"), "Extra Large");
    assert.equal(sizeLabel("XXL"), "2X Large");
    assert.equal(sizeLabel("3XL"), "3X Large");
    assert.equal(sizeLabel("Youth L"), "Youth L");
});
test("colorImageFor maps case-insensitively, else first image, else empty", () => {
    const p = { images: ["/a.jpg", "/b.jpg"], colorImages: [{ color: "St. Red", image: "/b.jpg" }] };
    assert.equal(colorImageFor(p, "st. red"), "/b.jpg");
    assert.equal(colorImageFor(p, "Blue"), "/a.jpg");
    assert.equal(colorImageFor(p, ""), "/a.jpg");
    assert.equal(colorImageFor({ images: ["/a.jpg"] }, "Red"), "/a.jpg");
    assert.equal(colorImageFor({}, "Red"), "");
    assert.equal(colorImageFor(null, "Red"), "");
});

test("cardSubtitle falls back from subtitle to shortDescription to empty", () => {
    assert.equal(cardSubtitle({ subtitle: "Sub", shortDescription: "Short" }), "Sub");
    assert.equal(cardSubtitle({ subtitle: "", shortDescription: "Short" }), "Short");
    assert.equal(cardSubtitle({ shortDescription: "" }), "");
    assert.equal(cardSubtitle(null), "");
});
