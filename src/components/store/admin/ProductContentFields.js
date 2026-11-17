"use client";

export const NEW_BADGE_OPTIONS = [
    { value: "auto", label: "Automatic (30 days)" },
    { value: "on", label: "Always show" },
    { value: "off", label: "Never show" },
];

/**
 * Storefront content fields: subtitle, headline, details, specs & care, tags, New badge.
 * @param {{ form: object, set: (patch: object) => void }} props
 */
export default function ProductContentFields({ form, set }) {
    const text = (field) => ({ value: form[field], onChange: (e) => set({ [field]: e.target.value }) });

    return (
        <>
            <div className="admin-form-group" style={{ maxWidth: 520 }}>
                <label className="admin-form-label" htmlFor="product-subtitle">Subtitle</label>
                <input id="product-subtitle" className="admin-form-input" maxLength={120} placeholder="e.g. Men's Short Sleeve" {...text("subtitle")} />
            </div>
            <div className="admin-form-group" style={{ maxWidth: 720 }}>
                <label className="admin-form-label" htmlFor="product-highlight">Description headline</label>
                <input id="product-highlight" className="admin-form-input" maxLength={200} {...text("highlight")} />
            </div>
            <div className="admin-form-group" style={{ maxWidth: 720 }}>
                <label className="admin-form-label" htmlFor="product-details">Product Details</label>
                <textarea id="product-details" className="admin-form-input" rows={5} maxLength={5000} {...text("details")} />
            </div>
            <div className="admin-form-group" style={{ maxWidth: 720 }}>
                <label className="admin-form-label" htmlFor="product-specs-care">Specs &amp; Care</label>
                <textarea id="product-specs-care" className="admin-form-input" rows={5} maxLength={5000} {...text("specsCare")} />
            </div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                <div className="admin-form-group" style={{ width: 360 }}>
                    <label className="admin-form-label" htmlFor="product-tags">Tags</label>
                    <input id="product-tags" className="admin-form-input" placeholder="Men, Shirts & Tops" {...text("tagsText")} />
                    <div style={{ fontSize: 11, color: "#5a5f72", marginTop: 4 }}>Comma-separated, up to 10</div>
                </div>
                <div className="admin-form-group" style={{ width: 220 }}>
                    <label className="admin-form-label" htmlFor="product-new-badge">&quot;New&quot; badge</label>
                    <select id="product-new-badge" className="admin-form-select" {...text("newBadge")}>
                        {NEW_BADGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
            </div>
        </>
    );
}
