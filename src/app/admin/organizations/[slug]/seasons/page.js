"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";
import { useToast } from "@/components/AdminToast";

function SeasonModal({ onClose, onSave, initial }) {
    const [form, setForm] = useState({
        name: initial?.name || "",
        type: initial?.type || "active",
        category: initial?.category || "",
        location: initial?.location || "",
        startDate: initial?.startDate ? new Date(initial.startDate).toISOString().split("T")[0] : "",
        time: initial?.time || "",
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await onSave(form);
        setSaving(false);
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <h3 className="admin-modal-title">{initial ? "Edit Season" : "Add Season"}</h3>
                <div className="admin-form-group">
                    <label className="admin-form-label">Name *</label>
                    <input className="admin-form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Spring 2026" />
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
                    <input className="admin-form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. 8U, 10U, Adult" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Location</label>
                    <input className="admin-form-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="e.g. Central Park Field" />
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
                        {saving ? "Saving..." : initial ? "Save Changes" : "Create Season"}
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

    const [seasons, setSeasons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);

    useEffect(() => {
        if (!impersonatedOrg && slug) {
            fetch(`/api/organizations/${slug}`)
                .then(r => r.json())
                .then(d => { if (d.success) enterImpersonation(d.data); })
                .catch(() => {});
        }
    }, [slug, impersonatedOrg, enterImpersonation]);

    const fetchSeasons = useCallback(async () => {
        try {
            const res = await fetch(`/api/organizations/${slug}/seasons`);
            const data = await res.json();
            if (data.success) setSeasons(data.data);
        } catch { showError("Failed to load seasons"); }
        finally { setLoading(false); }
    }, [slug]);

    useEffect(() => { fetchSeasons(); }, [fetchSeasons]);

    const handleSave = async (formData) => {
        try {
            if (editTarget) {
                const res = await fetch(`/api/seasons/${editTarget._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error); return; }
                showSuccess("Season updated!");
            } else {
                const res = await fetch(`/api/organizations/${slug}/seasons`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error); return; }
                showSuccess("Season created!");
            }
            setShowModal(false);
            setEditTarget(null);
            fetchSeasons();
        } catch { showError("Failed to save season"); }
    };

    const deleteSeason = async (season) => {
        if (!confirm(`Delete season "${season.name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/seasons/${season._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            fetchSeasons();
            showSuccess("Season deleted!");
        } catch { showError("Failed to delete season"); }
    };

    const canManage = user && hasAccess(user, "manage_seasons");
    const orgName = impersonatedOrg?.name || slug;

    return (
        <AdminLayout title="Seasons">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage seasons.</p>
                </div>
            ) : (
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3>{orgName} — Seasons ({seasons.length})</h3>
                        <button className="admin-btn admin-btn-primary" onClick={() => { setEditTarget(null); setShowModal(true); }}>
                            <i className="fa-solid fa-plus"></i> Add Season
                        </button>
                    </div>

                    {loading ? (
                        <div className="admin-loading"><div className="admin-spinner"></div>Loading seasons...</div>
                    ) : seasons.length === 0 ? (
                        <div className="admin-empty">
                            <i className="fa-solid fa-calendar-days"></i>
                            <p>No seasons yet. Create one to get started.</p>
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
                                    {seasons.map(s => (
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
                                                    <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteSeason(s)} title="Delete">
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
                <SeasonModal
                    initial={editTarget}
                    onClose={() => { setShowModal(false); setEditTarget(null); }}
                    onSave={handleSave}
                />
            )}
        </AdminLayout>
    );
}
