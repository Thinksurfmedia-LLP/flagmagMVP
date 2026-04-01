"use client";

import { useState, useEffect, useRef } from "react";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

export default function SettingsPage() {
    const { user, activeRole } = useAuth();
    const { showSuccess, showError } = useToast();

    const effectiveRole = activeRole || user?.role;
    const slug = user?.organization?.slug;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState({ logo: false, banner: false });
    const logoInputRef = useRef(null);
    const bannerInputRef = useRef(null);
    const [form, setForm] = useState({
        name: "",
        description: "",
        location: "",
        sport: "",
        foundedYear: "",
        logo: "",
        bannerImage: "",
        phone: "",
        email: "",
        website: "",
        facebook: "",
        twitter: "",
        instagram: "",
        scheduleDays: [],
    });

    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    useEffect(() => {
        if (!slug) return;
        (async () => {
            try {
                const res = await fetch(`/api/organizations/${slug}`);
                const data = await res.json();
                if (data.success) {
                    const org = data.data;
                    setForm({
                        name: org.name || "",
                        description: org.description || "",
                        location: org.location || "",
                        sport: org.sport || "",
                        foundedYear: org.foundedYear || "",
                        logo: org.logo || "",
                        bannerImage: org.bannerImage || "",
                        phone: org.contactInfo?.phone || "",
                        email: org.contactInfo?.email || "",
                        website: org.contactInfo?.website || "",
                        facebook: org.socialLinks?.facebook || "",
                        twitter: org.socialLinks?.twitter || "",
                        instagram: org.socialLinks?.instagram || "",
                        scheduleDays: org.scheduleDays || [],
                    });
                }
            } catch { showError("Failed to load organization"); }
            finally { setLoading(false); }
        })();
    }, [slug]);

    const toggleDay = (day) => {
        setForm(prev => ({
            ...prev,
            scheduleDays: prev.scheduleDays.includes(day)
                ? prev.scheduleDays.filter(d => d !== day)
                : [...prev.scheduleDays, day],
        }));
    };

    const handleImageUpload = async (file, field) => {
        if (!file) return;
        const key = field === "logo" ? "logo" : "banner";
        setUploading(prev => ({ ...prev, [key]: true }));
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (!data.success) { showError(data.error || "Upload failed"); return; }
            setForm(prev => ({ ...prev, [field]: data.url }));
            showSuccess("Image uploaded!");
        } catch { showError("Upload failed"); }
        finally { setUploading(prev => ({ ...prev, [key]: false })); }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                name: form.name,
                description: form.description,
                location: form.location,
                sport: form.sport,
                foundedYear: form.foundedYear ? Number(form.foundedYear) : undefined,
                logo: form.logo,
                bannerImage: form.bannerImage,
                contactInfo: { phone: form.phone, email: form.email, website: form.website },
                socialLinks: { facebook: form.facebook, twitter: form.twitter, instagram: form.instagram },
                scheduleDays: form.scheduleDays,
            };

            const res = await fetch(`/api/organizations/${slug}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            showSuccess("Settings saved!");
        } catch { showError("Failed to save settings"); }
        finally { setSaving(false); }
    };

    const canManage = effectiveRole === "organizer" || (user && hasAccess(user, "manage_organizations"));
    const isOrganizer = effectiveRole === "organizer";

    return (
        <AdminLayout title="Organization Settings">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage organization settings.</p>
                </div>
            ) : loading ? (
                <div className="admin-loading"><div className="admin-spinner"></div>Loading...</div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {/* General */}
                    <div className="admin-card">
                        <div className="admin-card-header"><h3>General</h3></div>
                        <div className="admin-card-body">
                            <div style={{ display: "flex", gap: 12 }}>
                                <div className="admin-form-group" style={{ flex: 2 }}>
                                    <label className="admin-form-label">Organization Name *</label>
                                    <input className="admin-form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                                </div>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        Sport
                                        {isOrganizer && <i className="fa-solid fa-lock" style={{ fontSize: 11, color: "#8b90a0" }}></i>}
                                    </label>
                                    <input
                                        className="admin-form-input"
                                        value={form.sport}
                                        onChange={e => !isOrganizer && setForm({ ...form, sport: e.target.value })}
                                        placeholder="e.g. Flag Football"
                                        readOnly={isOrganizer}
                                        style={isOrganizer ? { background: "#f3f4f6", color: "#6b7280", cursor: "not-allowed" } : {}}
                                    />
                                    {isOrganizer && (
                                        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8b90a0" }}>
                                            <i className="fa-solid fa-circle-info" style={{ marginRight: 4 }}></i>
                                            Contact admin to change this value.
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 12 }}>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label">Location</label>
                                    <input className="admin-form-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="City, State" />
                                </div>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label">Founded Year</label>
                                    <input type="number" className="admin-form-input" value={form.foundedYear} onChange={e => setForm({ ...form, foundedYear: e.target.value })} placeholder="e.g. 2020" />
                                </div>
                            </div>
                            <div className="admin-form-group">
                                <label className="admin-form-label">Description</label>
                                <textarea className="admin-form-input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="About the organization..." />
                            </div>
                        </div>
                    </div>

                    {/* Branding */}
                    <div className="admin-card">
                        <div className="admin-card-header"><h3>Branding</h3></div>
                        <div className="admin-card-body">
                            <div style={{ display: "flex", gap: 12 }}>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label">Logo URL</label>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <input className="admin-form-input" value={form.logo} onChange={e => setForm({ ...form, logo: e.target.value })} placeholder="https://..." style={{ flex: 1 }} />
                                        <button
                                            type="button"
                                            className="admin-btn admin-btn-ghost"
                                            style={{ whiteSpace: "nowrap" }}
                                            disabled={uploading.logo}
                                            onClick={() => logoInputRef.current?.click()}
                                        >
                                            <i className={uploading.logo ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-upload"}></i>
                                            {uploading.logo ? "Uploading..." : "Upload"}
                                        </button>
                                        <input
                                            ref={logoInputRef}
                                            type="file"
                                            accept="image/*"
                                            style={{ display: "none" }}
                                            onChange={e => handleImageUpload(e.target.files?.[0], "logo")}
                                        />
                                    </div>
                                    {form.logo && (
                                        <div style={{ marginTop: 8 }}>
                                            <img src={form.logo} alt="Logo preview" style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", border: "1px solid #e8eaef" }} />
                                        </div>
                                    )}
                                </div>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label">Banner Image URL</label>
                                    <div style={{ display: "flex", gap: 8 }}>
                                        <input className="admin-form-input" value={form.bannerImage} onChange={e => setForm({ ...form, bannerImage: e.target.value })} placeholder="https://..." style={{ flex: 1 }} />
                                        <button
                                            type="button"
                                            className="admin-btn admin-btn-ghost"
                                            style={{ whiteSpace: "nowrap" }}
                                            disabled={uploading.banner}
                                            onClick={() => bannerInputRef.current?.click()}
                                        >
                                            <i className={uploading.banner ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-upload"}></i>
                                            {uploading.banner ? "Uploading..." : "Upload"}
                                        </button>
                                        <input
                                            ref={bannerInputRef}
                                            type="file"
                                            accept="image/*"
                                            style={{ display: "none" }}
                                            onChange={e => handleImageUpload(e.target.files?.[0], "bannerImage")}
                                        />
                                    </div>
                                    {form.bannerImage && (
                                        <div style={{ marginTop: 8 }}>
                                            <img src={form.bannerImage} alt="Banner preview" style={{ height: 60, borderRadius: 8, objectFit: "cover", border: "1px solid #e8eaef" }} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact */}
                    <div className="admin-card">
                        <div className="admin-card-header"><h3>Contact Info</h3></div>
                        <div className="admin-card-body">
                            <div style={{ display: "flex", gap: 12 }}>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label">Phone</label>
                                    <input className="admin-form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(555) 123-4567" />
                                </div>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label">Email</label>
                                    <input type="email" className="admin-form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="info@league.com" />
                                </div>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label">Website</label>
                                    <input className="admin-form-input" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://..." />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Social */}
                    <div className="admin-card">
                        <div className="admin-card-header"><h3>Social Links</h3></div>
                        <div className="admin-card-body">
                            <div style={{ display: "flex", gap: 12 }}>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label"><i className="fa-brands fa-facebook" style={{ marginRight: 6 }}></i>Facebook</label>
                                    <input className="admin-form-input" value={form.facebook} onChange={e => setForm({ ...form, facebook: e.target.value })} placeholder="https://facebook.com/..." />
                                </div>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label"><i className="fa-brands fa-twitter" style={{ marginRight: 6 }}></i>Twitter</label>
                                    <input className="admin-form-input" value={form.twitter} onChange={e => setForm({ ...form, twitter: e.target.value })} placeholder="https://twitter.com/..." />
                                </div>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label"><i className="fa-brands fa-instagram" style={{ marginRight: 6 }}></i>Instagram</label>
                                    <input className="admin-form-input" value={form.instagram} onChange={e => setForm({ ...form, instagram: e.target.value })} placeholder="https://instagram.com/..." />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Schedule */}
                    <div className="admin-card">
                        <div className="admin-card-header"><h3>Schedule Days</h3></div>
                        <div className="admin-card-body">
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {DAYS.map(day => (
                                    <button
                                        key={day}
                                        type="button"
                                        className={`admin-btn ${form.scheduleDays.includes(day) ? "admin-btn-primary" : "admin-btn-ghost"}`}
                                        style={{ fontSize: 13 }}
                                        onClick={() => toggleDay(day)}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Save */}
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving} style={{ padding: "10px 32px" }}>
                            {saving ? "Saving..." : "Save Settings"}
                        </button>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
