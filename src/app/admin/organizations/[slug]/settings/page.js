"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";
import { useToast } from "@/components/AdminToast";

export default function OrgSettingsPage() {
    const { slug } = useParams();
    const { user } = useAuth();
    const { org: impersonatedOrg, enterImpersonation } = useImpersonation();
    const { showSuccess, showError } = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
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
        (async () => {
            try {
                const res = await fetch(`/api/organizations/${slug}`);
                const data = await res.json();
                if (data.success) {
                    const org = data.data;
                    if (!impersonatedOrg) enterImpersonation(org);
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

            // Update impersonation context with new name/logo if changed
            if (data.data) enterImpersonation(data.data);
            showSuccess("Settings saved!");
        } catch { showError("Failed to save settings"); }
        finally { setSaving(false); }
    };

    const canManage = user && hasAccess(user, "manage_organizations");

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
