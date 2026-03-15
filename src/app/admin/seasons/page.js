"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout, { hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
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
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                <h3 className="admin-modal-title">{initial ? "Edit Season" : "Add Season"}</h3>
                <div className="admin-form-group">
                    <label className="admin-form-label">Name *</label>
                    <input className="admin-form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Spring 2026" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Status</label>
                    <select className="admin-form-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                        <option value="active">Active</option>
                        <option value="past">Past</option>
                    </select>
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Category</label>
                    <input className="admin-form-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. 8U, Adult" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Location</label>
                    <input className="admin-form-input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Central Park Field" />
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                        <label className="admin-form-label">Start Date</label>
                        <input type="date" className="admin-form-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                    </div>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                        <label className="admin-form-label">Time</label>
                        <input className="admin-form-input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} placeholder="e.g. 6:00 PM" />
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

export default function OrganizerSeasonsPage() {
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();
    const [seasons, setSeasons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);

    const orgSlug = user?.organization?.slug;
    const orgName = user?.organization?.name || "Your Organization";

    const canView = hasAnyAccess(user, ["manage_seasons", "season_view", "season_create", "season_update", "season_delete"]);
    const canCreate = hasAnyAccess(user, ["manage_seasons", "season_create"]);
    const canUpdate = hasAnyAccess(user, ["manage_seasons", "season_update"]);
    const canDelete = hasAnyAccess(user, ["manage_seasons", "season_delete"]);

    const fetchSeasons = useCallback(async () => {
        if (!orgSlug || !canView) {
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`/api/organizations/${orgSlug}/seasons`);
            const data = await res.json();
            if (data.success) setSeasons(data.data);
            else showError(data.error || "Failed to load seasons");
        } catch {
            showError("Failed to load seasons");
        } finally {
            setLoading(false);
        }
    }, [orgSlug, canView, showError]);

    useEffect(() => {
        fetchSeasons();
    }, [fetchSeasons]);

    const handleSave = async (formData) => {
        if (!orgSlug) {
            showError("No organization is assigned to this organizer account.");
            return;
        }

        try {
            if (editTarget) {
                if (!canUpdate) {
                    showError("You do not have permission to update seasons.");
                    return;
                }

                const res = await fetch(`/api/seasons/${editTarget._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                });
                const data = await res.json();
                if (!data.success) {
                    showError(data.error);
                    return;
                }
                showSuccess("Season updated!");
            } else {
                if (!canCreate) {
                    showError("You do not have permission to create seasons.");
                    return;
                }

                const res = await fetch(`/api/organizations/${orgSlug}/seasons`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                });
                const data = await res.json();
                if (!data.success) {
                    showError(data.error);
                    return;
                }
                showSuccess("Season created!");
            }

            setShowModal(false);
            setEditTarget(null);
            fetchSeasons();
        } catch {
            showError("Failed to save season");
        }
    };

    const deleteSeason = async (season) => {
        if (!canDelete) {
            showError("You do not have permission to delete seasons.");
            return;
        }

        if (!confirm(`Delete season "${season.name}"? This cannot be undone.`)) return;

        try {
            const res = await fetch(`/api/seasons/${season._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) {
                showError(data.error);
                return;
            }
            fetchSeasons();
            showSuccess("Season deleted!");
        } catch {
            showError("Failed to delete season");
        }
    };

    return (
        <AdminLayout title="Seasons">
            {!canView ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to view seasons.</p>
                </div>
            ) : user?.role !== "admin" && !orgSlug ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <p>No organization is assigned to this organizer account yet.</p>
                </div>
            ) : (
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3>{orgName} - Seasons ({seasons.length})</h3>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {canCreate && (
                                <button className="admin-btn admin-btn-primary" onClick={() => { setEditTarget(null); setShowModal(true); }}>
                                    <i className="fa-solid fa-plus"></i> Add Season
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="admin-loading"><div className="admin-spinner"></div>Loading seasons...</div>
                    ) : seasons.length === 0 ? (
                        <div className="admin-empty">
                            <i className="fa-solid fa-calendar-days"></i>
                            <p>No seasons yet.</p>
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
                                    {seasons.map((season) => (
                                        <tr key={season._id}>
                                            <td style={{ fontWeight: 600 }}>{season.name}</td>
                                            <td>
                                                <span className={`admin-badge ${season.type === "active" ? "player" : ""}`}>
                                                    {season.type === "active" ? "Active" : "Past"}
                                                </span>
                                            </td>
                                            <td style={{ color: "#5a5f72" }}>{season.category || "-"}</td>
                                            <td style={{ color: "#5a5f72" }}>{season.location || "-"}</td>
                                            <td style={{ color: "#8b90a0", fontSize: 13 }}>
                                                {season.startDate ? new Date(season.startDate).toLocaleDateString() : "-"}
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    {canUpdate && (
                                                        <button
                                                            className="admin-btn admin-btn-ghost admin-btn-sm"
                                                            onClick={() => { setEditTarget(season); setShowModal(true); }}
                                                            title="Edit"
                                                        >
                                                            <i className="fa-solid fa-pen"></i>
                                                        </button>
                                                    )}
                                                    {canDelete && (
                                                        <button
                                                            className="admin-btn admin-btn-danger admin-btn-sm"
                                                            onClick={() => deleteSeason(season)}
                                                            title="Delete"
                                                        >
                                                            <i className="fa-solid fa-trash"></i>
                                                        </button>
                                                    )}
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
