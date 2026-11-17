"use client";

import { useState } from "react";

export const MAX_VARIANTS = 50;
const SIZE_PRESET = ["XS", "S", "M", "L", "XL", "XXL"];
const DEFAULT_HEX = "#000000";

export const emptyVariant = () => ({ sku: "", size: "", color: "", colorHex: "", stock: "0" });

const comboKey = (v) => `${v.size.trim().toLowerCase()}|${v.color.trim().toLowerCase()}`;

/**
 * Editable variant table. Rows use string stock so inputs stay controlled.
 * @param {{ variants: object[], onChange: (v: object[]) => void, error?: string }} props
 */
export default function VariantsEditor({ variants, onChange, error }) {
    const [genColor, setGenColor] = useState("");
    const [genHex, setGenHex] = useState("");

    const update = (index, patch) =>
        onChange(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));
    const remove = (index) => onChange(variants.filter((_, i) => i !== index));

    const generate = () => {
        const color = genColor.trim();
        const existing = new Set(variants.map(comboKey));
        const added = SIZE_PRESET
            .map((size) => ({ sku: "", size, color, colorHex: genHex, stock: "0" }))
            .filter((v) => !existing.has(comboKey(v)));
        onChange([...variants, ...added].slice(0, MAX_VARIANTS));
    };

    const input = (v, i, field, props = {}) => (
        <input
            id={`variant-${i}-${field}`}
            aria-label={`${field} for row ${i + 1}`}
            className="admin-form-input"
            style={{ height: 34, fontSize: 13 }}
            value={v[field]}
            onChange={(e) => update(i, { [field]: e.target.value })}
            {...props}
        />
    );

    return (
        <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
                <label htmlFor="variant-gen-color" style={{ fontSize: 13 }}>Generate sizes for colour:</label>
                <input id="variant-gen-color" className="admin-form-input" style={{ width: 140, height: 34, fontSize: 13 }} placeholder="e.g. Black" value={genColor} onChange={(e) => setGenColor(e.target.value)} />
                <input id="variant-gen-hex" type="color" aria-label="Colour swatch for generated rows" value={genHex || DEFAULT_HEX} onChange={(e) => setGenHex(e.target.value)} style={{ width: 40, height: 34, padding: 2 }} />
                <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={generate}>
                    <i className="fa-solid fa-wand-magic-sparkles"></i> Generate sizes (XS-XXL)
                </button>
            </div>

            <div style={{ overflowX: "auto" }}>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Size</th><th>Colour</th><th style={{ width: 80 }}>Swatch</th>
                            <th>SKU (optional)</th><th style={{ width: 90 }}>Stock</th><th style={{ width: 50 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {variants.map((v, i) => (
                            <tr key={i}>
                                <td>{input(v, i, "size", { placeholder: "M" })}</td>
                                <td>{input(v, i, "color", { placeholder: "Black" })}</td>
                                <td>
                                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                        <input
                                            id={`variant-${i}-colorHex`}
                                            type="color"
                                            aria-label={`Swatch for row ${i + 1}`}
                                            value={v.colorHex || DEFAULT_HEX}
                                            onChange={(e) => update(i, { colorHex: e.target.value })}
                                            style={{ width: 36, height: 34, padding: 2 }}
                                        />
                                        {v.colorHex && (
                                            <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" title="Clear swatch" aria-label="Clear swatch" onClick={() => update(i, { colorHex: "" })}>
                                                <i className="fa-solid fa-xmark"></i>
                                            </button>
                                        )}
                                    </div>
                                </td>
                                <td>{input(v, i, "sku", { placeholder: "auto" })}</td>
                                <td>{input(v, i, "stock", { type: "number", min: 0, step: 1 })}</td>
                                <td>
                                    <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" title="Remove row" aria-label={`Remove row ${i + 1}`} onClick={() => remove(i)}>
                                        <i className="fa-solid fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {error && <div role="alert" style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>{error}</div>}

            <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" style={{ marginTop: 10 }} disabled={variants.length >= MAX_VARIANTS} onClick={() => onChange([...variants, emptyVariant()])}>
                <i className="fa-solid fa-plus"></i> Add variant
            </button>
            <span style={{ marginLeft: 12, fontSize: 12, color: "#5a5f72" }}>{variants.length}/{MAX_VARIANTS} variants</span>
        </div>
    );
}
