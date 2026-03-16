"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout, { hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

function SeasonModal({ onClose, onSave, initial, categoryOptions = [], venuesByCounty = [] }) {
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
    });
    const [saving, setSaving] = useState(false);

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
                    <select className="admin-form-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                        <option value="">Select category</option>
                        {categoryOptions.map((category) => (
                            <option key={category} value={category}>{category}</option>
                        ))}
                    </select>
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
                <div className="admin-form-group">
                    <label className="admin-form-label">Start Date</label>
                    <input type="date" className="admin-form-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
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
    const [organization, setOrganization] = useState(null);
    const [allVenues, setAllVenues] = useState([]);

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

    const fetchOrganization = useCallback(async () => {
        if (!orgSlug || !canView) return;
        try {
            const res = await fetch(`/api/organizations/${orgSlug}`);
            const data = await res.json();
            if (data.success) setOrganization(data.data);
        } catch {
            // Non-blocking; season list still works without metadata.
        }
    }, [orgSlug, canView]);

    const fetchVenues = useCallback(async () => {
        try {
            const res = await fetch("/api/locations");
            const data = await res.json();
            if (data.success) setAllVenues(data.data || []);
        } catch { /* non-blocking */ }
    }, []);

    useEffect(() => {
        fetchSeasons();
        fetchOrganization();
        fetchVenues();
    }, [fetchSeasons, fetchOrganization, fetchVenues]);

    const categoryOptions = (organization?.categories || []).map((entry) => String(entry).trim()).filter(Boolean);

    const orgCountyIds = (organization?.locations || []).map((entry) => String(entry.county || entry.countyId)).filter(Boolean);
    const venuesByCounty = orgCountyIds.reduce((groups, countyId) => {
        const venues = allVenues.filter((v) => String(v.countyId) === countyId);
        const sample = allVenues.find((v) => String(v.countyId) === countyId) || organization?.locations?.find((l) => String(l.county || l.countyId) === countyId);
        const countyLabel = sample ? `${sample.countyName || ""} (${sample.stateAbbr || sample.stateName || ""})`.trim() : countyId;
        if (!groups.some((g) => g.countyId === countyId)) {
            groups.push({ countyId, countyLabel, venues });
        }
        return groups;
    }, []);

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
                                            <td style={{ color: "#5a5f72" }}>
                                                {Array.isArray(season.locations) && season.locations.length > 0
                                                    ? season.locations.join(", ")
                                                    : season.location || "-"}
                                            </td>
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
                    categoryOptions={categoryOptions}
                    venuesByCounty={venuesByCounty}
                    onClose={() => { setShowModal(false); setEditTarget(null); }}
                    onSave={handleSave}
                />
            )}
        </AdminLayout>
    );
}
