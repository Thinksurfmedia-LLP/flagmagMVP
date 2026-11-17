const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeSettingsInput, MAX_SETTINGS_TEXT } = require("../src/lib/store/settingsInput.js");

test("accepts and trims valid settings", () => {
    const r = normalizeSettingsInput({ refundPolicy: "  30 days.  ", sizeGuideText: "S 36", sizeGuideImage: "/api/uploads/g.png" });
    assert.deepEqual(r, { ok: true, value: { refundPolicy: "30 days.", sizeGuideText: "S 36", sizeGuideImage: "/api/uploads/g.png" } });
});

test("missing fields default to empty strings", () => {
    assert.deepEqual(normalizeSettingsInput({}).value, { refundPolicy: "", sizeGuideText: "", sizeGuideImage: "" });
});

test("rejects non-object bodies", () => {
    for (const body of [null, undefined, "x", 5, [], true]) {
        assert.equal(normalizeSettingsInput(body).ok, false);
    }
});

test("enforces text length limits", () => {
    const long = "a".repeat(MAX_SETTINGS_TEXT + 1);
    assert.equal(normalizeSettingsInput({ refundPolicy: long }).ok, false);
    assert.equal(normalizeSettingsInput({ sizeGuideText: long }).ok, false);
    assert.equal(normalizeSettingsInput({ refundPolicy: "a".repeat(MAX_SETTINGS_TEXT) }).ok, true);
});

test("rejects non-string text", () => {
    assert.equal(normalizeSettingsInput({ refundPolicy: 5 }).ok, false);
});

test("applies the product image URL rule", () => {
    for (const bad of ["https://evil.com/a.png", "/api/uploads/../x.png", "/api/uploads/%2e%2e/x", "/assets/images/a\\b.png", "/other/a.png", "/api/uploads/"]) {
        assert.equal(normalizeSettingsInput({ sizeGuideImage: bad }).ok, false, bad);
    }
    assert.equal(normalizeSettingsInput({ sizeGuideImage: "/assets/images/a.png" }).ok, true);
});
