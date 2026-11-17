"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";
import { uploadImage } from "@/lib/uploadImage";

const MAX_TEXT = 5000;

export default function StoreSettingsPage() {
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();

    const [refundPolicy, setRefundPolicy] = useState("");
    const [sizeGuideText, setSizeGuideText] = useState("");
    const [sizeGuideImage, setSizeGuideImage] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    const isAdmin = user?.role === "admin";

    useEffect(() => {
        if (!isAdmin) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/store/settings");
                const data = await res.json();
                if (cancelled) return;
                if (data.success) {
                    setRefundPolicy(data.data.refundPolicy || "");
                    setSizeGuideText(data.data.sizeGuideText || "");
                    setSizeGuideImage(data.data.sizeGuideImage || "");
                } else {
                    showError(data.error || "Failed to load settings");
                }
            } catch {
                if (!cancelled) showError("Failed to load settings");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [isAdmin, showError]);

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingImage(true);
        try {
            setSizeGuideImage(await uploadImage(file));
        } catch (err) { showError(err.message); }
        finally { setUploadingImage(false); }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/store/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refundPolicy, sizeGuideText, sizeGuideImage }),
            });
            const data = await res.json();
            if (data.success) showSuccess("Store settings saved");
            else showError(data.error || "Save failed");
        } catch { showError("Save failed"); } finally { setSaving(false); }
    };

    if (!isAdmin) {
        return (
            <AdminLayout title="Store Settings">
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage store settings.</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Store Settings">
            <div className="admin-card">
                <div className="admin-card-header">
                    <h3>Product page content</h3>
                </div>
                {loading ? (
                    <div className="admin-loading"><div className="admin-spinner"></div>Loading settings...</div>
                ) : (
                    <div style={{ padding: "20px 24px" }}>
                        <form onSubmit={handleSave}>
                            <div className="admin-form-group" style={{ maxWidth: 720 }}>
                                <label className="admin-form-label" htmlFor="store-refund-policy">Refund Policy</label>
                                <textarea
                                    id="store-refund-policy"
                                    className="admin-form-input"
                                    rows={6}
                                    maxLength={MAX_TEXT}
                                    value={refundPolicy}
                                    onChange={e => setRefundPolicy(e.target.value)}
                                    placeholder="Shown in the Refund Policy accordion on every product page"
                                />
                            </div>
                            <div className="admin-form-group" style={{ maxWidth: 720 }}>
                                <label className="admin-form-label" htmlFor="store-size-guide-text">Size &amp; Fit Guide text</label>
                                <textarea
                                    id="store-size-guide-text"
                                    className="admin-form-input"
                                    rows={8}
                                    maxLength={MAX_TEXT}
                                    value={sizeGuideText}
                                    onChange={e => setSizeGuideText(e.target.value)}
                                    placeholder="Shown in the size guide popup. Line breaks are kept."
                                />
                            </div>
                            <div className="admin-form-group" style={{ maxWidth: 720 }}>
                                <span className="admin-form-label">Size guide image</span>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    {sizeGuideImage && <img src={sizeGuideImage} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4 }} />}
                                    <label className="admin-btn admin-btn-ghost" htmlFor="store-size-guide-image" style={{ cursor: "pointer", marginBottom: 0 }}>
                                        <i className="fa-solid fa-upload"></i>
                                        {uploadingImage ? "Uploading..." : "Upload Image"}
                                    </label>
                                    <input id="store-size-guide-image" type="file" accept="image/*" onChange={handleUpload} hidden disabled={uploadingImage} />
                                    {sizeGuideImage && (
                                        <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setSizeGuideImage("")}>Remove</button>
                                    )}
                                </div>
                                <div style={{ marginTop: 6, fontSize: 12, color: "#dc2626" }}>Max file size: 1MB</div>
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                                <button type="submit" className="admin-btn admin-btn-primary" disabled={saving || uploadingImage}>
                                    {saving ? "Saving..." : "Save Settings"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
