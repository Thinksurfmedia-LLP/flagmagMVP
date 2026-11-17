"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/AdminToast";
import ImagesEditor from "./ImagesEditor";
import VariantsEditor, { emptyVariant } from "./VariantsEditor";
import ProductContentFields from "./ProductContentFields";
import ColorPhotosEditor from "./ColorPhotosEditor";
import { pruneColorImages } from "@/lib/store/colorPhotos";

const STATUSES = ["draft", "active", "archived"];

function toFormState(product) {
    if (!product) {
        return {
            name: "", category: "", shortDescription: "", description: "",
            price: "", compareAtPrice: "", isFeatured: false, status: "draft",
            images: [], variants: [emptyVariant()],
            subtitle: "", highlight: "", details: "", specsCare: "",
            tagsText: "", newBadge: "auto", colorImages: [],
        };
    }
    return {
        name: product.name || "",
        category: product.category?._id || product.category || "",
        shortDescription: product.shortDescription || "",
        description: product.description || "",
        price: product.price != null ? String(product.price) : "",
        compareAtPrice: product.compareAtPrice != null ? String(product.compareAtPrice) : "",
        isFeatured: !!product.isFeatured,
        status: product.status || "draft",
        images: product.images || [],
        subtitle: product.subtitle || "",
        highlight: product.highlight || "",
        details: product.details || "",
        specsCare: product.specsCare || "",
        tagsText: (product.tags || []).join(", "),
        newBadge: product.newBadge || "auto",
        colorImages: (product.colorImages || []).map((e) => ({ color: e.color, image: e.image })),
        variants: (product.variants || []).map((v) => ({
            sku: v.sku || "", size: v.size || "", color: v.color || "",
            colorHex: v.colorHex || "", stock: String(v.stock ?? 0),
        })),
    };
}

function toPayload(form) {
    return {
        name: form.name.trim(),
        category: form.category,
        shortDescription: form.shortDescription.trim(),
        description: form.description,
        images: form.images,
        subtitle: form.subtitle.trim(),
        highlight: form.highlight.trim(),
        details: form.details,
        specsCare: form.specsCare,
        tags: form.tagsText.split(",").map((t) => t.trim()).filter(Boolean),
        newBadge: form.newBadge,
        colorImages: pruneColorImages(form.colorImages, form.variants, form.images),
        price: form.price,
        compareAtPrice: form.compareAtPrice === "" ? null : form.compareAtPrice,
        variants: form.variants.map((v) => ({ ...v, stock: v.stock === "" ? "" : Number(v.stock) })),
        status: form.status, // always sent: PUT is a full replace and a missing status would unpublish
        isFeatured: form.isFeatured,
    };
}

/**
 * Create / edit form for a store product.
 * @param {{ initial: object|null, onSaved: (product: object) => void }} props
 */
export default function ProductForm({ initial, onSaved }) {
    const { showSuccess, showError } = useToast();
    const [form, setForm] = useState(() => toFormState(initial));
    const [categories, setCategories] = useState([]);
    const [saving, setSaving] = useState(false);
    const [variantError, setVariantError] = useState("");

    useEffect(() => {
        let cancelled = false;
        fetch("/api/store/categories")
            .then((r) => r.json())
            .then((d) => {
                if (cancelled) return;
                if (d.success) setCategories(d.data || []);
                else showError(d.error || "Failed to load categories");
            })
            .catch(() => !cancelled && showError("Failed to load categories"));
        return () => { cancelled = true; };
    }, [showError]);

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const text = (field) => ({ value: form[field], onChange: (e) => set({ [field]: e.target.value }) });

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.category) { showError("Choose a category"); return; }
        if (form.images.length === 0) { showError("Add at least one image"); return; }
        setSaving(true);
        setVariantError("");
        try {
            const url = initial ? `/api/store/products/${initial._id}` : "/api/store/products";
            const res = await fetch(url, {
                method: initial ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(toPayload(form)),
            });
            const data = await res.json();
            if (!data.success) {
                const message = data.error || "Save failed";
                if (/variant|sku/i.test(message)) setVariantError(message);
                showError(message);
                return;
            }
            showSuccess(initial ? "Product updated" : "Product created");
            onSaved(data.data);
        } catch {
            showError("Save failed");
        } finally {
            setSaving(false);
        }
    };

    const sectionStyle = { padding: "20px 24px", borderBottom: "1px solid #eef0f4" };

    return (
        <form onSubmit={handleSubmit}>
            <div className="admin-card" style={{ marginBottom: 24 }}>
                <div className="admin-card-header">
                    <h3>{initial ? "Edit Product" : "New Product"}</h3>
                    <div style={{ display: "flex", gap: 8 }}>
                        {initial && form.status === "active" && initial.slug && (
                            <Link className="admin-btn admin-btn-ghost" href={`/store/${initial.slug}`} target="_blank">
                                <i className="fa-solid fa-arrow-up-right-from-square"></i> View in store
                            </Link>
                        )}
                        <Link className="admin-btn admin-btn-ghost" href="/admin/store/products">Back to products</Link>
                    </div>
                </div>

                <div style={sectionStyle}>
                    <div className="admin-form-group" style={{ maxWidth: 520 }}>
                        <label className="admin-form-label" htmlFor="product-name">Name *</label>
                        <input id="product-name" className="admin-form-input" required maxLength={120} {...text("name")} />
                    </div>
                    <div className="admin-form-group" style={{ maxWidth: 520 }}>
                        <label className="admin-form-label" htmlFor="product-category">Category *</label>
                        <select id="product-category" className="admin-form-select" required {...text("category")}>
                            <option value="">Select a category</option>
                            {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="admin-form-group" style={{ maxWidth: 520 }}>
                        <label className="admin-form-label" htmlFor="product-short">Short description (shown when no subtitle)</label>
                        <input id="product-short" className="admin-form-input" maxLength={200} {...text("shortDescription")} />
                    </div>
                    <div className="admin-form-group" style={{ maxWidth: 720 }}>
                        <label className="admin-form-label" htmlFor="product-description">Description</label>
                        <textarea id="product-description" className="admin-form-input" rows={6} maxLength={5000} {...text("description")} />
                    </div>
                    <ProductContentFields form={form} set={set} />
                </div>

                <div style={sectionStyle}>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        <div className="admin-form-group" style={{ width: 160 }}>
                            <label className="admin-form-label" htmlFor="product-price">Price (USD) *</label>
                            <input id="product-price" className="admin-form-input" type="number" step="0.01" min="1" max="5000" required {...text("price")} />
                        </div>
                        <div className="admin-form-group" style={{ width: 200 }}>
                            <label className="admin-form-label" htmlFor="product-compare">Compare-at price</label>
                            <input id="product-compare" className="admin-form-input" type="number" step="0.01" min="1" {...text("compareAtPrice")} />
                            <div style={{ fontSize: 11, color: "#5a5f72", marginTop: 4 }}>Ignored unless higher than price</div>
                        </div>
                        <div className="admin-form-group" style={{ width: 160 }}>
                            <label className="admin-form-label" htmlFor="product-status">Status</label>
                            <select id="product-status" className="admin-form-select" {...text("status")}>
                                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    <label htmlFor="product-featured" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                        <input id="product-featured" type="checkbox" checked={form.isFeatured} onChange={(e) => set({ isFeatured: e.target.checked })} />
                        Featured product
                    </label>
                </div>

                <div style={sectionStyle}>
                    <h4 style={{ marginTop: 0 }}>Images</h4>
                    <ImagesEditor images={form.images} onChange={(images) => set({ images, colorImages: pruneColorImages(form.colorImages, form.variants, images) })} onError={showError} />
                </div>

                <div style={sectionStyle}>
                    <h4 style={{ marginTop: 0 }}>Variants</h4>
                    <VariantsEditor
                        variants={form.variants}
                        onChange={(variants) => { setVariantError(""); set({ variants }); }}
                        error={variantError}
                    />
                </div>

                <div style={sectionStyle}>
                    <h4 style={{ marginTop: 0 }}>Colour photos</h4>
                    <ColorPhotosEditor
                        variants={form.variants}
                        images={form.images}
                        value={form.colorImages}
                        onChange={(colorImages) => set({ colorImages })}
                    />
                </div>

                <div style={{ padding: "16px 24px", display: "flex", gap: 8 }}>
                    <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                        {saving ? "Saving..." : initial ? "Save changes" : "Create product"}
                    </button>
                    <Link className="admin-btn admin-btn-ghost" href="/admin/store/products">Cancel</Link>
                </div>
            </div>
        </form>
    );
}
