"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";
import { useRouter } from "next/navigation";

const EMPTY_FORM = {
    phone: "",
    email: "",
    address: "",
    facebook: "",
    twitter: "",
    instagram: "",
    youtube: "",
};

export default function SiteSettingsPage() {
    const { user, loading: authLoading } = useAuth();
    const { showSuccess, showError } = useToast();
    const router = useRouter();

    const [form, setForm] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const isAdmin = user?.role === "admin" || user?.roles?.includes("admin");

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.replace("/admin");
        }
    }, [authLoading, isAdmin, router]);

    const fetchSettings = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/site-settings");
            const data = await res.json();
            if (data.success && data.data) {
                setForm({
                    phone: data.data.phone || "",
                    email: data.data.email || "",
                    address: data.data.address || "",
                    facebook: data.data.facebook || "",
                    twitter: data.data.twitter || "",
                    instagram: data.data.instagram || "",
                    youtube: data.data.youtube || "",
                });
            }
        } catch {
            showError("Failed to load settings");
        } finally {
            setLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        if (isAdmin) fetchSettings();
    }, [isAdmin, fetchSettings]);

    const handleChange = (e) => {
        setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch("/api/site-settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (data.success) {
                showSuccess("Site settings saved successfully");
            } else {
                showError(data.error || "Failed to save settings");
            }
        } catch {
            showError("Failed to save settings");
        } finally {
            setSaving(false);
        }
    };

    if (authLoading || loading) {
        return (
            <AdminLayout title="Site Settings">
                <div className="admin-loading"><div className="admin-spinner"></div>Loading...</div>
            </AdminLayout>
        );
    }

    if (!isAdmin) return null;

    return (
        <AdminLayout title="Site Settings">
            <form onSubmit={handleSave}>
                {/* Contact Info */}
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3><i className="fa-solid fa-address-card" style={{ marginRight: 7, color: "#FF1E00" }}></i>Contact Information</h3>
                    </div>
                    <div className="admin-card-body" style={{ padding: "20px 24px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                <label className="admin-form-label">Phone Number</label>
                                <input
                                    type="text"
                                    name="phone"
                                    className="admin-form-input"
                                    value={form.phone}
                                    onChange={handleChange}
                                    placeholder="+1-(855) 000-0000"
                                />
                            </div>
                            <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                <label className="admin-form-label">Email Address</label>
                                <input
                                    type="email"
                                    name="email"
                                    className="admin-form-input"
                                    value={form.email}
                                    onChange={handleChange}
                                    placeholder="info@flagmag.com"
                                />
                            </div>
                            <div className="admin-form-group" style={{ marginBottom: 0, gridColumn: "1 / -1" }}>
                                <label className="admin-form-label">Address</label>
                                <input
                                    type="text"
                                    name="address"
                                    className="admin-form-input"
                                    value={form.address}
                                    onChange={handleChange}
                                    placeholder="123 Main St, City, State, ZIP"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Social Links */}
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3><i className="fa-solid fa-share-nodes" style={{ marginRight: 7, color: "#FF1E00" }}></i>Social Media Links</h3>
                    </div>
                    <div className="admin-card-body" style={{ padding: "20px 24px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                            <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                <label className="admin-form-label">
                                    <i className="fa-brands fa-facebook-f" style={{ marginRight: 5, color: "#1877f2" }}></i>Facebook URL
                                </label>
                                <input
                                    type="url"
                                    name="facebook"
                                    className="admin-form-input"
                                    value={form.facebook}
                                    onChange={handleChange}
                                    placeholder="https://facebook.com/flagmag"
                                />
                            </div>
                            <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                <label className="admin-form-label">
                                    <i className="fa-brands fa-x-twitter" style={{ marginRight: 5 }}></i>X (Twitter) URL
                                </label>
                                <input
                                    type="url"
                                    name="twitter"
                                    className="admin-form-input"
                                    value={form.twitter}
                                    onChange={handleChange}
                                    placeholder="https://x.com/flagmag"
                                />
                            </div>
                            <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                <label className="admin-form-label">
                                    <i className="fa-brands fa-instagram" style={{ marginRight: 5, color: "#e1306c" }}></i>Instagram URL
                                </label>
                                <input
                                    type="url"
                                    name="instagram"
                                    className="admin-form-input"
                                    value={form.instagram}
                                    onChange={handleChange}
                                    placeholder="https://instagram.com/flagmag"
                                />
                            </div>
                            <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                <label className="admin-form-label">
                                    <i className="fa-brands fa-youtube" style={{ marginRight: 5, color: "#ff0000" }}></i>YouTube URL
                                </label>
                                <input
                                    type="url"
                                    name="youtube"
                                    className="admin-form-input"
                                    value={form.youtube}
                                    onChange={handleChange}
                                    placeholder="https://youtube.com/@flagmag"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                        {saving ? (
                            <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</>
                        ) : (
                            <><i className="fa-solid fa-floppy-disk"></i> Save Settings</>
                        )}
                    </button>
                </div>
            </form>
        </AdminLayout>
    );
}
