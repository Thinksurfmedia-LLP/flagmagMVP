"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";
import { useToast } from "@/components/AdminToast";

function LeagueModal({ onClose, onSave, initial, orgCategories, venuesByCounty = [] }) {
    const [form, setForm] = useState({
        name: initial?.name || "",
        type: initial?.type || "active",
        category: initial?.category || "",
        locations: Array.isArray(initial?.locations)
            ? initial.locations
            : initial?.location
                ? [initial.location]
                : [],
        startDate: initial?.startDate ? new Date(initial.startDate).toISOString().split("T")[0] : "",
        time: initial?.time || "",
        image: initial?.image || "",
    });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (data.success) setForm(prev => ({ ...prev, image: data.url }));
        } catch {}
        setUploading(false);
    };

    const toggleVenue = (venueName) => {
        setForm((prev) => ({
            ...prev,
            locations: prev.locations.includes(venueName)
                ? prev.locations.filter((v) => v !== venueName)
                : [...prev.locations, venueName],
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        await onSave(form);
        setSaving(false);
    };

    const hasVenues = venuesByCounty.some((group) => group.venues.length > 0);

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <h3 className="admin-modal-title">{initial ? "Edit League" : "Add League"}</h3>
                <div className="admin-form-group">
                    <label className="admin-form-label">Name *</label>
                    <input className="admin-form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Spring 2026 League" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">League Image</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {form.image && (
                            <img src={form.image} alt="League" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1px solid #333" }} />
                        )}
                        <label className="admin-btn admin-btn-ghost admin-btn-sm" style={{ cursor: "pointer", margin: 0 }}>
                            {uploading ? "Uploading..." : form.image ? "Change Image" : "Upload Image"}
                            <input type="file" accept="image/*" onChange={handleImageUpload} hidden disabled={uploading} />
                        </label>
                        {form.image && (
                            <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setForm(prev => ({ ...prev, image: "" }))} style={{ color: "#ef4444" }}>Remove</button>
                        )}
                    </div>
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Status</label>
                    <select className="admin-form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                        <option value="active">Active</option>
                        <option value="past">Past</option>
                    </select>
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Category</label>
                    {orgCategories && orgCategories.length > 0 ? (
                        <select className="admin-form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                            <option value="">Select category</option>
                            {orgCategories.map(category => (
                                <option key={category} value={category}>{category}</option>
                            ))}
                        </select>
                    ) : (
                        <input className="admin-form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Men, Women, Coed" />
                    )}
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Venues</label>
                    <div className="admin-location-list" style={{ maxHeight: 220 }}>
                        {!hasVenues ? (
                            <div style={{ color: "#8b90a0", fontSize: 13 }}>No venues found for this organization&apos;s operating locations.</div>
                        ) : venuesByCounty.map((group) => (
                            group.venues.length > 0 && (
                                <div key={group.countyId}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8b90a0", textTransform: "uppercase", letterSpacing: 0.5, padding: "8px 4px 4px" }}>
                                        {group.countyLabel}
                                    </div>
                                    {group.venues.map((venue) => {
                                        const checked = form.locations.includes(venue.name);
                                        return (
                                            <label key={venue._id} className={`admin-location-option ${checked ? "selected" : ""}`}>
                                                <input type="checkbox" checked={checked} onChange={() => toggleVenue(venue.name)} />
                                                <span>
                                                    {venue.name}
                                                    {venue.address && <small>{venue.address}</small>}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )
                        ))}
                    </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                        <label className="admin-form-label">Start Date</label>
                        <input type="date" className="admin-form-input" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                    </div>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                        <label className="admin-form-label">Time</label>
                        <input className="admin-form-input" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} placeholder="e.g. 6:00 PM" />
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : initial ? "Save Changes" : "Create League"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function OrgSeasonsPage() {
    const { slug } = useParams();
    const { user } = useAuth();
    const { org: impersonatedOrg, enterImpersonation } = useImpersonation();
    const { showSuccess, showError } = useToast();

    const [leagues, setLeagues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [allVenues, setAllVenues] = useState([]);

    useEffect(() => {
        if (!impersonatedOrg && slug) {
            fetch(`/api/organizations/${slug}`)
                .then(r => r.json())
                .then(d => { if (d.success) enterImpersonation(d.data); })
                .catch(() => {});
        }
    }, [slug, impersonatedOrg, enterImpersonation]);

    useEffect(() => {
        fetch("/api/locations")
            .then(r => r.json())
            .then(d => { if (d.success) setAllVenues(d.data || []); })
            .catch(() => {});
    }, []);

    const orgCountyIds = (impersonatedOrg?.locations || []).map((entry) => String(entry.county || entry.countyId)).filter(Boolean);
    const venuesByCounty = orgCountyIds.reduce((groups, countyId) => {
        const venues = allVenues.filter((v) => String(v.countyId) === countyId);
        const sample = allVenues.find((v) => String(v.countyId) === countyId) || (impersonatedOrg?.locations || []).find((l) => String(l.county || l.countyId) === countyId);
        const countyLabel = sample ? `${sample.countyName || ""} (${sample.stateAbbr || sample.stateName || ""})`.trim() : countyId;
        if (!groups.some((g) => g.countyId === countyId)) {
            groups.push({ countyId, countyLabel, venues });
        }
        return groups;
    }, []);

    const fetchLeagues = useCallback(async () => {
        try {
            const res = await fetch(`/api/organizations/${slug}/leagues`);
            const data = await res.json();
            if (data.success) setLeagues(data.data);
        } catch { showError("Failed to load leagues"); }
        finally { setLoading(false); }
    }, [slug]);

    useEffect(() => { fetchLeagues(); }, [fetchLeagues]);

    const handleSave = async (formData) => {
        try {
            if (editTarget) {
                const res = await fetch(`/api/leagues/${editTarget._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error); return; }
                showSuccess("League updated!");
            } else {
                const res = await fetch(`/api/organizations/${slug}/leagues`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error); return; }
                showSuccess("League created!");
            }
            setShowModal(false);
            setEditTarget(null);
            fetchLeagues();
        } catch { showError("Failed to save league"); }
    };

    const deleteLeague = async (league) => {
        if (!confirm(`Delete league "${league.name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/leagues/${league._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            fetchLeagues();
            showSuccess("League deleted!");
        } catch { showError("Failed to delete league"); }
    };

    const canManage = user && hasAccess(user, "manage_seasons");
    const orgName = impersonatedOrg?.name || slug;

    return (
        <AdminLayout title="Leagues">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage leagues.</p>
                </div>
            ) : (
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3>{orgName} — Leagues ({leagues.length})</h3>
                        <button className="admin-btn admin-btn-primary" onClick={() => { setEditTarget(null); setShowModal(true); }}>
                            <i className="fa-solid fa-plus"></i> Add League
                        </button>
                    </div>

                    {loading ? (
                        <div className="admin-loading"><div className="admin-spinner"></div>Loading leagues...</div>
                    ) : leagues.length === 0 ? (
                        <div className="admin-empty">
                            <i className="fa-solid fa-calendar-days"></i>
                            <p>No leagues yet. Create one to get started.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Status</th>
                                        <th>Category</th>
                                        <th>Location</th>
                                        <th>Start Date</th>
                                        <th style={{ width: 120 }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leagues.map(s => (
                                        <tr key={s._id}>
                                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                                            <td>
                                                <span className={`admin-badge ${s.type === "active" ? "player" : ""}`}>
                                                    {s.type === "active" ? "Active" : "Past"}
                                                </span>
                                            </td>
                                            <td style={{ color: "#5a5f72" }}>{s.category || "—"}</td>
                                            <td style={{ color: "#5a5f72" }}>{s.location || "—"}</td>
                                            <td style={{ color: "#8b90a0", fontSize: 13 }}>
                                                {s.startDate ? new Date(s.startDate).toLocaleDateString() : "—"}
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => { setEditTarget(s); setShowModal(true); }} title="Edit">
                                                        <i className="fa-solid fa-pen"></i>
                                                    </button>
                                                    <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteLeague(s)} title="Delete">
                                                        <i className="fa-solid fa-trash"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
            {showModal && (
                <LeagueModal
                    initial={editTarget}
                    onClose={() => { setShowModal(false); setEditTarget(null); }}
                    onSave={handleSave}
                    orgCategories={impersonatedOrg?.categories || []}
                    venuesByCounty={venuesByCounty}
                />
            )}
        </AdminLayout>
    );
}
