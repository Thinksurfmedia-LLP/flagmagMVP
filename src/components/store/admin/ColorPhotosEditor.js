"use client";

export const distinctColors = (variants) => {
    const seen = new Map();
    for (const v of variants) {
        const color = (v.color || "").trim();
        if (color && !seen.has(color.toLowerCase())) seen.set(color.toLowerCase(), color);
    }
    return [...seen.values()];
};

const sameColor = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Drop photo mappings whose colour is gone or whose image was removed. */
export function pruneColorImages(colorImages, variants, images) {
    const colors = distinctColors(variants);
    return colorImages.filter((e) => images.includes(e.image) && colors.some((c) => sameColor(c, e.color)));
}

/**
 * One row per variant colour: pick which product image represents it.
 * @param {{ variants: object[], images: string[], value: {color: string, image: string}[], onChange: (v: object[]) => void }} props
 */
export default function ColorPhotosEditor({ variants, images, value, onChange }) {
    const colors = distinctColors(variants);
    if (colors.length === 0) {
        return <p style={{ fontSize: 13, color: "#5a5f72", margin: 0 }}>Add a colour to a variant to choose its photo.</p>;
    }

    const choose = (color, image) => {
        const rest = value.filter((e) => !sameColor(e.color, color));
        onChange(image ? [...rest, { color, image }] : rest);
    };

    return (
        <div>
            {colors.map((color, ci) => {
                const current = value.find((e) => sameColor(e.color, color))?.image || "";
                const name = `color-photo-${ci}`;
                return (
                    <fieldset key={color.toLowerCase()} style={{ border: "1px solid #e3e5ec", borderRadius: 6, padding: "8px 12px", marginBottom: 10 }}>
                        <legend style={{ fontSize: 13, fontWeight: 600, padding: "0 6px" }}>{color}</legend>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                            <label htmlFor={`${name}-none`} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                                <input id={`${name}-none`} type="radio" name={name} checked={current === ""} onChange={() => choose(color, "")} />
                                None (use first image)
                            </label>
                            {images.map((url, i) => (
                                <label key={url} htmlFor={`${name}-${i}`} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                                    <input id={`${name}-${i}`} type="radio" name={name} checked={current === url} onChange={() => choose(color, url)} />
                                    <img src={url} alt={`${color} photo option ${i + 1}`} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 4, outline: current === url ? "2px solid #2563eb" : "1px solid #e3e5ec" }} />
                                </label>
                            ))}
                        </div>
                    </fieldset>
                );
            })}
        </div>
    );
}
