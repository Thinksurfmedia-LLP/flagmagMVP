"use client";

import { useState } from "react";
import { uploadImage } from "@/lib/uploadImage";

export const MAX_IMAGES = 8;

/**
 * Ordered image list; the first image is the cover.
 * @param {{ images: string[], onChange: (images: string[]) => void, onError: (msg: string) => void }} props
 */
export default function ImagesEditor({ images, onChange, onError }) {
    const [uploading, setUploading] = useState(false);
    const atLimit = images.length >= MAX_IMAGES;

    const handleFiles = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (files.length === 0) return;
        setUploading(true);
        let next = images;
        try {
            for (const file of files) {
                if (next.length >= MAX_IMAGES) {
                    onError(`Only ${MAX_IMAGES} images are allowed`);
                    break;
                }
                const url = await uploadImage(file); // sequential on purpose
                next = [...next, url];
                onChange(next);
            }
        } catch (err) {
            onError(err.message);
        } finally {
            setUploading(false);
        }
    };

    const remove = (index) => onChange(images.filter((_, i) => i !== index));

    const move = (index, delta) => {
        const target = index + delta;
        if (target < 0 || target >= images.length) return;
        const next = [...images];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    return (
        <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {images.map((url, index) => (
                    <div key={`${url}-${index}`} style={{ width: 120, border: "1px solid #e3e5ec", borderRadius: 6, padding: 6 }}>
                        <img src={url} alt={`Product image ${index + 1}`} style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 4 }} />
                        <div style={{ fontSize: 11, color: "#5a5f72", margin: "4px 0", minHeight: 16 }}>
                            {index === 0 ? "Cover" : `Image ${index + 1}`}
                        </div>
                        <div style={{ display: "flex", gap: 4 }}>
                            <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" title="Move left" aria-label="Move image left" disabled={uploading || index === 0} onClick={() => move(index, -1)}>
                                <i className="fa-solid fa-chevron-left"></i>
                            </button>
                            <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" title="Move right" aria-label="Move image right" disabled={uploading || index === images.length - 1} onClick={() => move(index, 1)}>
                                <i className="fa-solid fa-chevron-right"></i>
                            </button>
                            <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" title="Remove" aria-label="Remove image" disabled={uploading} onClick={() => remove(index)}>
                                <i className="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
            <div style={{ marginTop: 12 }}>
                <label className="admin-btn admin-btn-ghost" style={{ cursor: atLimit || uploading ? "not-allowed" : "pointer", marginBottom: 0, opacity: atLimit ? 0.5 : 1 }}>
                    <i className="fa-solid fa-upload"></i>
                    {uploading ? "Uploading..." : "Upload Images"}
                    <input type="file" accept="image/*" multiple hidden onChange={handleFiles} disabled={atLimit || uploading} />
                </label>
                <span style={{ marginLeft: 12, fontSize: 12, color: "#5a5f72" }}>
                    {images.length}/{MAX_IMAGES} images · first image is the cover · max 1MB each
                </span>
            </div>
        </div>
    );
}
