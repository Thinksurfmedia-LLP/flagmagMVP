// Input validation for store-wide settings. Pure CommonJS with relative
// requires only, so it runs under `node --test`.

const { isAllowedImage } = require("./productInput.js");

const MAX_SETTINGS_TEXT = 5000;

const fail = (error) => ({ ok: false, error });

function readText(raw, label) {
    if (raw === undefined || raw === null) return { ok: true, value: "" };
    if (typeof raw !== "string") return fail(`${label} must be text`);
    const value = raw.trim();
    if (value.length > MAX_SETTINGS_TEXT) {
        return fail(`${label} must be ${MAX_SETTINGS_TEXT} characters or fewer`);
    }
    return { ok: true, value };
}

function normalizeSettingsInput(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return fail("Invalid request body");
    }
    const refundPolicy = readText(body.refundPolicy, "Refund policy");
    if (!refundPolicy.ok) return refundPolicy;
    const sizeGuideText = readText(body.sizeGuideText, "Size guide text");
    if (!sizeGuideText.ok) return sizeGuideText;
    const image = readText(body.sizeGuideImage, "Size guide image");
    if (!image.ok) return image;
    if (image.value !== "" && !isAllowedImage(image.value)) {
        return fail("Image URL must start with /api/uploads/ or /assets/images/");
    }
    return {
        ok: true,
        value: {
            refundPolicy: refundPolicy.value,
            sizeGuideText: sizeGuideText.value,
            sizeGuideImage: image.value,
        },
    };
}

module.exports = { normalizeSettingsInput, MAX_SETTINGS_TEXT };
