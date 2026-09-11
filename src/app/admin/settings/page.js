"use client";

import { useState, useEffect, useRef } from "react";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
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

export default function SettingsPage() {
    const { user, activeRole, logout } = useAuth();
    const { showSuccess, showError } = useToast();

    const effectiveRole = activeRole || user?.role;
    const organizerOrg = user?.roleOrganizations?.[effectiveRole] || user?.organization;
    const slug = organizerOrg?.slug;

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [forcingLogout, setForcingLogout] = useState(false);
    const [orgId, setOrgId] = useState(null);

    // Retired jersey numbers — per team, managed here instead of the Manage
    // Players modal so it reads as an organization-wide policy tool rather
    // than something buried in one team's roster editor.
    const [teams, setTeams] = useState([]);
    const [loadingTeams, setLoadingTeams] = useState(false);
    const [selectedTeamId, setSelectedTeamId] = useState("");
    const [rosterHistory, setRosterHistory] = useState([]);
    const [loadingRosterHistory, setLoadingRosterHistory] = useState(false);
    const [retireJersey, setRetireJersey] = useState("");
    const [retirePlayerId, setRetirePlayerId] = useState("");
    const [retireReason, setRetireReason] = useState("");
    const [retiring, setRetiring] = useState(false);
    const [uploading, setUploading] = useState({ logo: false, banner: false });
    const [uploadingCustomIcon, setUploadingCustomIcon] = useState(null); // index of the row currently uploading, or null
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
        youtube: "",
        tiktok: "",
        linkedin: "",
        threads: "",
        customSocialLinks: [],
        scheduleDays: [],
    });

    const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const DAY_ABBR_TO_FULL = {
        MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday",
        FRI: "Friday", SAT: "Saturday", SUN: "Sunday",
    };
    const DAY_FULL_TO_ABBR = {
        Monday: "MON", Tuesday: "TUE", Wednesday: "WED", Thursday: "THU",
        Friday: "FRI", Saturday: "SAT", Sunday: "SUN",
    };
    // Returns true whether scheduleDays stores "Saturday" or "SAT"
    const isDayActive = (fullName) => {
        const abbr = DAY_FULL_TO_ABBR[fullName];
        return form.scheduleDays.some(d => d === fullName || d === abbr || d?.toUpperCase() === abbr);
    };

    useEffect(() => {
        if (!slug) return;
        (async () => {
            try {
                const res = await fetch(`/api/organizations/${slug}`);
                const data = await res.json();
                if (data.success) {
                    const org = data.data;
                    setOrgId(org._id);
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

    useEffect(() => {
        if (!orgId) return;
        (async () => {
            setLoadingTeams(true);
            try {
                const res = await fetch(`/api/teams?organization=${orgId}`);
                const data = await res.json();
                if (data.success) setTeams((data.data || []).filter((t) => !t.isPlaceholder));
            } catch { showError("Failed to load teams"); }
            finally { setLoadingTeams(false); }
        })();
    }, [orgId]);

    useEffect(() => {
        if (!selectedTeamId) { setRosterHistory([]); return; }
        (async () => {
            setLoadingRosterHistory(true);
            setRetirePlayerId("");
            try {
                const res = await fetch(`/api/teams/${selectedTeamId}/roster-history`);
                const data = await res.json();
                if (data.success) setRosterHistory(data.data || []);
                else showError(data.error || "Failed to load this team's roster history");
            } catch { showError("Failed to load this team's roster history"); }
            finally { setLoadingRosterHistory(false); }
        })();
    }, [selectedTeamId]);

    const selectedTeam = teams.find((t) => String(t._id) === selectedTeamId) || null;
    const retiredNumbers = (selectedTeam?.retiredNumbers || []).map((r) => ({
        jerseyNumber: String(r.jerseyNumber),
        playerId: r.player?._id ? String(r.player._id) : "",
        playerName: r.player?.name || "",
        reason: r.reason || "",
    }));

    const persistRetiredNumbers = async (nextRetired, successMessage) => {
        setRetiring(true);
        try {
            const res = await fetch(`/api/teams/${selectedTeamId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    retiredNumbers: nextRetired.map((r) => ({ jerseyNumber: r.jerseyNumber, player: r.playerId || null, reason: r.reason })),
                }),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error || "Failed to update retired numbers"); return false; }
            setTeams((prev) => prev.map((t) => String(t._id) === selectedTeamId ? data.data : t));
            showSuccess(successMessage);
            return true;
        } catch {
            showError("Failed to update retired numbers");
            return false;
        } finally {
            setRetiring(false);
        }
    };

    const handleRetire = async () => {
        const num = retireJersey.trim();
        if (!num || !retirePlayerId) return;
        if (retiredNumbers.some((r) => r.jerseyNumber === num)) {
            showError(`#${num} is already retired for this team`);
            return;
        }
        const player = rosterHistory.find((p) => String(p._id) === retirePlayerId);
        const ok = await persistRetiredNumbers(
            [...retiredNumbers, { jerseyNumber: num, playerId: retirePlayerId, playerName: player?.name || "", reason: retireReason.trim() }],
            `#${num} reserved for ${player?.name || "this player"} on ${selectedTeam?.name}`
        );
        if (ok) { setRetireJersey(""); setRetirePlayerId(""); setRetireReason(""); }
    };

    const handleUnretire = async (entry) => {
        if (!confirm(`Stop reserving #${entry.jerseyNumber} on ${selectedTeam?.name}? Any player on this team could be assigned it again.`)) return;
        await persistRetiredNumbers(retiredNumbers.filter((r) => r.jerseyNumber !== entry.jerseyNumber), `#${entry.jerseyNumber} released`);
    };

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
            // A file over the server's upload limit never reaches our API route at
            // all — nginx rejects it with a raw 413 HTML page, not JSON, so calling
            // res.json() on it throws and used to fall through to a generic
            // "Upload failed" toast. Catch that case by status before parsing.
            if (res.status === 413) { showError("Upload size limit exceeded. Maximum file size is 1MB."); return; }
            const data = await res.json();
            if (!data.success) { showError(data.error || "Upload failed"); return; }
            setForm(prev => ({ ...prev, [field]: data.url }));
            showSuccess("Image uploaded!");
        } catch { showError("Upload failed"); }
        finally { setUploading(prev => ({ ...prev, [key]: false })); }
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
                scheduleDays: form.scheduleDays.map(d => DAY_FULL_TO_ABBR[d] || d),
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

    const handleForceLogout = async () => {
        if (!slug) return;
        if (!window.confirm(
            `Log out everyone linked to ${form.name || "this organization"} — organizers and statisticians, ` +
            "on both the admin dashboard and the stats app? This includes you. Everyone will need to log back in."
        )) {
            return;
        }
        setForcingLogout(true);
        try {
            const res = await fetch(`/api/organizations/${slug}/force-logout`, { method: "POST" });
            const data = await res.json();
            if (data.success) {
                showSuccess("Everyone has been logged out. Redirecting you to login...");
                await clearClientCaches();
                await logout();
                window.location.href = "/login";
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
                            <div className="settings-form-row" style={{ display: "flex", gap: 12 }}>
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
                            <div className="settings-form-row" style={{ display: "flex", gap: 12 }}>
                                <div className="admin-form-group" style={{ flex: 1 }}>
                                    <label className="admin-form-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        Location
                                        {isOrganizer && <i className="fa-solid fa-lock" style={{ fontSize: 11, color: "#8b90a0" }}></i>}
                                    </label>
                                    <input
                                        className="admin-form-input"
                                        value={form.location}
                                        onChange={e => !isOrganizer && setForm({ ...form, location: e.target.value })}
                                        placeholder="City, State"
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
                            <div className="settings-form-row" style={{ display: "flex", gap: 12 }}>
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
                                    <div style={{ marginTop: 6, fontSize: 12, color: "#dc2626" }}>Max file size: 1MB</div>
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
                                    <div style={{ marginTop: 6, fontSize: 12, color: "#dc2626" }}>Max file size: 1MB</div>
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
                            <div className="settings-form-row" style={{ display: "flex", gap: 12 }}>
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
                            <div className="settings-form-row" style={{ display: "flex", gap: 12 }}>
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
                            <div className="settings-form-row" style={{ display: "flex", gap: 12 }}>
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
                        <div className="admin-card-header" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <h3 style={{ margin: 0 }}>Schedule Days</h3>
                            {isOrganizer && <i className="fa-solid fa-lock" style={{ fontSize: 12, color: "#8b90a0" }}></i>}
                        </div>
                        <div className="admin-card-body">
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {DAYS.map(day => (
                                    <button
                                        key={day}
                                        type="button"
                                        className={`admin-btn ${isDayActive(day) ? "admin-btn-primary" : "admin-btn-ghost"}`}
                                        style={{ fontSize: 13, ...(isOrganizer ? { opacity: isDayActive(day) ? 1 : 0.45, cursor: "not-allowed", pointerEvents: "none" } : {}) }}
                                        onClick={() => !isOrganizer && toggleDay(day)}
                                        disabled={isOrganizer}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                            {isOrganizer && (
                                <p style={{ margin: "10px 0 0", fontSize: 12, color: "#8b90a0" }}>
                                    <i className="fa-solid fa-circle-info" style={{ marginRight: 4 }}></i>
                                    Contact admin to change schedule days.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Retired Jersey Numbers */}
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3><i className="fa-solid fa-shirt" style={{ marginRight: 7, color: "#FF1E00" }}></i>Retired Jersey Numbers</h3>
                        </div>
                        <div className="admin-card-body">
                            <p style={{ marginBottom: 16, color: "#666" }}>
                                Reserve a number for a specific player on one team — no one else can be
                                assigned it on THAT team going forward, this season or any future one.
                                Other teams (in this or any other league) are unaffected — the same
                                number is still free to use elsewhere.
                            </p>

                            <div className="admin-form-group">
                                <label className="admin-form-label">Team</label>
                                <select
                                    className="admin-form-select"
                                    value={selectedTeamId}
                                    onChange={(e) => setSelectedTeamId(e.target.value)}
                                    disabled={loadingTeams}
                                >
                                    <option value="">{loadingTeams ? "Loading teams..." : "Select a team..."}</option>
                                    {teams.map((t) => (
                                        <option key={t._id} value={t._id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>

                            {selectedTeamId && (
                                <>
                                    {retiredNumbers.length > 0 && (
                                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                                            {retiredNumbers.map((entry) => (
                                                <div key={entry.jerseyNumber} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap", padding: "8px 10px", background: "#f9fafb", border: "1px solid #e8eaef", borderRadius: 6 }}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                                        <span style={{ fontWeight: 700, fontSize: 13, color: "#1a1d26" }}>#{entry.jerseyNumber}</span>
                                                        <span style={{ fontSize: 13, color: "#1a1d26" }}>{entry.playerName || "(unknown player)"}</span>
                                                        {entry.reason && <span style={{ fontSize: 12, color: "#8b90a0" }}>{entry.reason}</span>}
                                                    </div>
                                                    <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => handleUnretire(entry)} disabled={retiring}>
                                                        <i className="fa-solid fa-rotate-left"></i> Release
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                        <select
                                            className="admin-form-select"
                                            style={{ flex: "1 1 220px" }}
                                            value={retirePlayerId}
                                            onChange={(e) => setRetirePlayerId(e.target.value)}
                                            disabled={loadingRosterHistory}
                                        >
                                            <option value="">{loadingRosterHistory ? "Loading players..." : "Select a player who's ever played for this team..."}</option>
                                            {rosterHistory.map((p) => (
                                                <option key={p._id} value={p._id}>{p.name}</option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            className="admin-form-input"
                                            style={{ width: 110, flexShrink: 0 }}
                                            value={retireJersey}
                                            onChange={(e) => setRetireJersey(e.target.value)}
                                            placeholder="Number"
                                        />
                                        <input
                                            className="admin-form-input"
                                            style={{ flex: "1 1 160px" }}
                                            value={retireReason}
                                            onChange={(e) => setRetireReason(e.target.value)}
                                            placeholder="Reason (optional)"
                                        />
                                        <button
                                            className="admin-btn admin-btn-primary"
                                            onClick={handleRetire}
                                            disabled={retiring || !retireJersey.trim() || !retirePlayerId}
                                        >
                                            Reserve
                                        </button>
                                    </div>
                                </>
                            )}
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
                                schedule changes. This includes you.
                            </p>
                            <button
                                type="button"
                                className="admin-btn admin-btn-danger"
                                onClick={handleForceLogout}
                                disabled={forcingLogout || !slug}
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
