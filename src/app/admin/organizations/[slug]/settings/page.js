"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";
import { useToast } from "@/components/AdminToast";

// Wipes local browser state so a force-logged-out user actually gets a
// clean build on next login, not a login screen over stale cached assets.
async function clearClientCaches() {
    try { sessionStorage.clear(); } catch { }
    try { localStorage.clear(); } catch { }
    if (typeof caches !== "undefined") {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
        } catch { }
    }
    if (typeof navigator !== "undefined" && navigator.serviceWorker) {
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((reg) => reg.unregister()));
        } catch { }
    }
}

export default function OrgSettingsPage() {
    const { slug } = useParams();
    const { user, activeRole, logout } = useAuth();
    const { org: impersonatedOrg, enterImpersonation } = useImpersonation();
    const { showSuccess, showError } = useToast();

    const effectiveRole = activeRole || user?.role;
    const isOwnOrg = effectiveRole === "organizer" && user?.organization?.slug === slug;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [forcingLogout, setForcingLogout] = useState(false);
    const [uploadingCustomIcon, setUploadingCustomIcon] = useState(null); // index of the row currently uploading, or null
    const [form, setForm] = useState({
        name: "",
        description: "",
        location: "",
        sport: "",
        foundedYear: "",
        timezone: "America/Los_Angeles",
        logo: "",
        bannerImage: "",
        phone: "",
        email: "",
        website: "",
        facebook: "",
        twitter: "",
        instagram: "",
        youtube: "",
        tiktok: "",
        linkedin: "",
        threads: "",
        customSocialLinks: [],
        scheduleDays: [],
    });

    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/organizations/${slug}`);
                const data = await res.json();
                if (data.success) {
                    const org = data.data;
                    if (!isOwnOrg && !impersonatedOrg) enterImpersonation(org);
                    setForm({
                        name: org.name || "",
                        description: org.description || "",
                        location: org.location || "",
                        sport: org.sport || "",
                        foundedYear: org.foundedYear || "",
                        timezone: org.timezone || "America/Los_Angeles",
                        logo: org.logo || "",
                        bannerImage: org.bannerImage || "",
                        phone: org.contactInfo?.phone || "",
                        email: org.contactInfo?.email || "",
                        website: org.contactInfo?.website || "",
                        facebook: org.socialLinks?.facebook || "",
                        twitter: org.socialLinks?.twitter || "",
                        instagram: org.socialLinks?.instagram || "",
                        youtube: org.socialLinks?.youtube || "",
                        tiktok: org.socialLinks?.tiktok || "",
                        linkedin: org.socialLinks?.linkedin || "",
                        threads: org.socialLinks?.threads || "",
                        customSocialLinks: org.customSocialLinks?.length
                            ? org.customSocialLinks.map(l => ({ label: l.label || "", url: l.url || "", icon: l.icon || "" }))
                            : [],
                        scheduleDays: org.scheduleDays || [],
                    });
                }
            } catch { showError("Failed to load organization"); }
            finally { setLoading(false); }
        })();
    }, [slug]);

    const addCustomLink = () => {
        setForm(prev => ({ ...prev, customSocialLinks: [...prev.customSocialLinks, { label: "", url: "", icon: "" }] }));
    };
    const updateCustomLink = (index, field, value) => {
        setForm(prev => ({
            ...prev,
            customSocialLinks: prev.customSocialLinks.map((link, i) => i === index ? { ...link, [field]: value } : link),
        }));
    };
    const removeCustomLink = (index) => {
        setForm(prev => ({ ...prev, customSocialLinks: prev.customSocialLinks.filter((_, i) => i !== index) }));
    };
    const handleCustomIconUpload = async (file, index) => {
        if (!file) return;
        setUploadingCustomIcon(index);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            if (res.status === 413) { showError("Upload size limit exceeded. Maximum file size is 1MB."); return; }
            const data = await res.json();
            if (!data.success) { showError(data.error || "Upload failed"); return; }
            updateCustomLink(index, "icon", data.url);
            showSuccess("Icon uploaded!");
        } catch { showError("Upload failed"); }
        finally { setUploadingCustomIcon(null); }
    };

    const toggleDay = (day) => {
        setForm(prev => ({
            ...prev,
            scheduleDays: prev.scheduleDays.includes(day)
                ? prev.scheduleDays.filter(d => d !== day)
                : [...prev.scheduleDays, day],
        }));
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
                timezone: form.timezone,
                logo: form.logo,
                bannerImage: form.bannerImage,
                contactInfo: { phone: form.phone, email: form.email, website: form.website },
                socialLinks: {
                    facebook: form.facebook,
                    twitter: form.twitter,
                    instagram: form.instagram,
                    youtube: form.youtube,
                    tiktok: form.tiktok,
                    linkedin: form.linkedin,
                    threads: form.threads,
                },
                customSocialLinks: form.customSocialLinks.filter(l => l.label.trim() && l.url.trim()),
                scheduleDays: form.scheduleDays,
            };

            const res = await fetch(`/api/organizations/${slug}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }

            // Update impersonation context with new name/logo if changed
            if (!isOwnOrg && data.data) enterImpersonation(data.data);
            showSuccess("Settings saved!");
        } catch { showError("Failed to save settings"); }
        finally { setSaving(false); }
    };

    const canManage = isOwnOrg || (user && hasAccess(user, "manage_organizations"));

    const handleForceLogout = async () => {
        if (!window.confirm(
            `Log out everyone linked to ${form.name || "this organization"} — organizers and statisticians, ` +
            `on both the admin dashboard and the stats app?${isOwnOrg ? " This includes you." : ""} ` +
            "Everyone will need to log back in."
        )) {
            return;
        }
        setForcingLogout(true);
        try {
            const res = await fetch(`/api/organizations/${slug}/force-logout`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                if (isOwnOrg) {
                    showSuccess("Everyone has been logged out. Redirecting you to login...");
                    await clearClientCaches();
                    await logout();
                    window.location.href = "/login";
                } else {
                    showSuccess("Everyone linked to this organization has been logged out.");
                }
            } else {
                showError(data.error || "Failed to log everyone out");
            }
        } catch {
            showError("Failed to log everyone out");
        } finally {
            setForcingLogout(false);
        }
    };

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
                                    <label className="admin-form-label">Sport</label>
                                    <input className="admin-form-input" value={form.sport} onChange={e => setForm({ ...form, sport: e.target.value })} placeholder="e.g. Flag Football" />
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
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label">Timezone</label>
                                    <select className="admin-form-input" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}>
                                        <option value="America/New_York">Eastern Time (ET)</option>
                                        <option value="America/Chicago">Central Time (CT)</option>
                                        <option value="America/Denver">Mountain Time (MT)</option>
                                        <option value="America/Phoenix">Mountain Time – Arizona (no DST)</option>
                                        <option value="America/Los_Angeles">Pacific Time (PT)</option>
                                        <option value="America/Anchorage">Alaska Time (AKT)</option>
                                        <option value="Pacific/Honolulu">Hawaii Time (HT)</option>
                                        <option value="UTC">UTC</option>
                                    </select>
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
                                    <input className="admin-form-input" value={form.logo} onChange={e => setForm({ ...form, logo: e.target.value })} placeholder="https://..." />
                                </div>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label">Banner Image URL</label>
                                    <input className="admin-form-input" value={form.bannerImage} onChange={e => setForm({ ...form, bannerImage: e.target.value })} placeholder="https://..." />
                                </div>
                            </div>
                            {(form.logo || form.bannerImage) && (
                                <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                                    {form.logo && <img src={form.logo} alt="Logo preview" style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", border: "1px solid #e8eaef" }} />}
                                    {form.bannerImage && <img src={form.bannerImage} alt="Banner preview" style={{ height: 60, borderRadius: 8, objectFit: "cover", border: "1px solid #e8eaef" }} />}
                                </div>
                            )}
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
                            <div style={{ display: "flex", gap: 12 }}>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label"><i className="fa-brands fa-youtube" style={{ marginRight: 6 }}></i>YouTube</label>
                                    <input className="admin-form-input" value={form.youtube} onChange={e => setForm({ ...form, youtube: e.target.value })} placeholder="https://youtube.com/..." />
                                </div>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label"><i className="fa-brands fa-tiktok" style={{ marginRight: 6 }}></i>TikTok</label>
                                    <input className="admin-form-input" value={form.tiktok} onChange={e => setForm({ ...form, tiktok: e.target.value })} placeholder="https://tiktok.com/@..." />
                                </div>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label"><i className="fa-brands fa-linkedin" style={{ marginRight: 6 }}></i>LinkedIn</label>
                                    <input className="admin-form-input" value={form.linkedin} onChange={e => setForm({ ...form, linkedin: e.target.value })} placeholder="https://linkedin.com/company/..." />
                                </div>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label"><i className="fa-brands fa-threads" style={{ marginRight: 6 }}></i>Threads</label>
                                    <input className="admin-form-input" value={form.threads} onChange={e => setForm({ ...form, threads: e.target.value })} placeholder="https://threads.net/@..." />
                                </div>
                            </div>

                            <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e8eaef" }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                                    <label className="admin-form-label" style={{ margin: 0 }}>Custom Links</label>
                                    <button type="button" className="admin-btn admin-btn-ghost" style={{ fontSize: 13 }} onClick={addCustomLink}>
                                        <i className="fa-solid fa-plus"></i> Add Custom Link
                                    </button>
                                </div>
                                {form.customSocialLinks.length === 0 ? (
                                    <p style={{ margin: 0, fontSize: 13, color: "#8b90a0" }}>No custom links yet. Add any platform not listed above with your own icon.</p>
                                ) : (
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                        {form.customSocialLinks.map((link, i) => (
                                            <div key={i} style={{ border: "1px solid #e8eaef", borderRadius: 8, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                                                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                                                    <div className="admin-form-group" style={{ flex: 1, margin: 0 }}>
                                                        <label className="admin-form-label">Label</label>
                                                        <input className="admin-form-input" value={link.label} onChange={e => updateCustomLink(i, "label", e.target.value)} placeholder="e.g. Discord" />
                                                    </div>
                                                    <div className="admin-form-group" style={{ flex: 2, margin: 0 }}>
                                                        <label className="admin-form-label">URL</label>
                                                        <input className="admin-form-input" value={link.url} onChange={e => updateCustomLink(i, "url", e.target.value)} placeholder="https://..." />
                                                    </div>
                                                    <div style={{ width: 36, height: 36, borderRadius: 8, border: "1px solid #e8eaef", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                        {link.icon ? (
                                                            link.icon.trim().startsWith("fa-")
                                                                ? <i className={link.icon} style={{ fontSize: 15 }}></i>
                                                                : <img src={link.icon} alt="" style={{ width: 20, height: 20, objectFit: "contain" }} />
                                                        ) : (
                                                            <i className="fa-solid fa-link" style={{ fontSize: 13, color: "#c4c8d2" }}></i>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="admin-btn admin-btn-ghost"
                                                        style={{ flexShrink: 0, height: 36, color: "#dc2626" }}
                                                        onClick={() => removeCustomLink(i)}
                                                        aria-label="Remove custom link"
                                                    >
                                                        <i className="fa-solid fa-trash"></i>
                                                    </button>
                                                </div>
                                                <div className="admin-form-group" style={{ margin: 0 }}>
                                                    <label className="admin-form-label">Icon</label>
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        <input className="admin-form-input" value={link.icon} onChange={e => updateCustomLink(i, "icon", e.target.value)} placeholder="fa-brands fa-discord or image URL" style={{ flex: 1 }} />
                                                        <label
                                                            className="admin-btn admin-btn-ghost"
                                                            style={{ flexShrink: 0, cursor: uploadingCustomIcon === i ? "not-allowed" : "pointer", opacity: uploadingCustomIcon === i ? 0.6 : 1 }}
                                                            title="Upload icon image"
                                                        >
                                                            <i className={uploadingCustomIcon === i ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-upload"}></i>
                                                            &nbsp;Upload
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                style={{ display: "none" }}
                                                                disabled={uploadingCustomIcon === i}
                                                                onChange={e => { handleCustomIconUpload(e.target.files?.[0], i); e.target.value = ""; }}
                                                            />
                                                        </label>
                                                    </div>
                                                    <div style={{ marginTop: 4, fontSize: 12, color: "#8b90a0" }}>
                                                        Font Awesome class, image URL, or upload an image. <span style={{ color: "#dc2626" }}>Max file size: 1MB.</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
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

                    {/* Session Access */}
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3><i className="fa-solid fa-power-off" style={{ marginRight: 7, color: "#FF1E00" }}></i>Session Access</h3>
                        </div>
                        <div className="admin-card-body">
                            <p style={{ marginBottom: 16, color: "#666" }}>
                                Force everyone linked to this organization — organizers and statisticians,
                                on both the admin dashboard and the stats app — to log back in. Use this
                                right before games start so everyone picks up the latest roster and
                                schedule changes.
                            </p>
                            <button
                                type="button"
                                className="admin-btn admin-btn-danger"
                                onClick={handleForceLogout}
                                disabled={forcingLogout}
                            >
                                {forcingLogout ? (
                                    <><i className="fa-solid fa-spinner fa-spin"></i> Logging everyone out...</>
                                ) : (
                                    <><i className="fa-solid fa-right-from-bracket"></i> Force Logout Everyone</>
                                )}
                            </button>
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
