// Pure helpers for the admin colour-photo mapping. CommonJS for `node --test`.

/** Distinct variant colours (case-insensitive), first spelling wins. */
const distinctColors = (variants) => {
    const seen = new Map();
    for (const v of variants) {
        const color = (v.color || "").trim();
        if (color && !seen.has(color.toLowerCase())) seen.set(color.toLowerCase(), color);
    }
    return [...seen.values()];
};

const sameColor = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Drop photo mappings whose colour is gone or whose image was removed. */
function pruneColorImages(colorImages, variants, images) {
    const colors = distinctColors(variants);
    return colorImages.filter((e) => images.includes(e.image) && colors.some((c) => sameColor(c, e.color)));
}

module.exports = { distinctColors, sameColor, pruneColorImages };
