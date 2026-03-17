"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout, { hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

export default function SeasonsPage() {
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();

    const [seasons, setSeasons] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [sortCol, setSortCol] = useState(null);
    const [sortDir, setSortDir] = useState("asc");

    const toggleSort = (col) => {
        if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortCol(col); setSortDir("asc"); }
    };

    const sortIcon = (col) => {
        if (sortCol !== col) return <i className="fa-solid fa-sort" style={{ opacity: 0.3, marginLeft: 4 }}></i>;
        return sortDir === "asc"
            ? <i className="fa-solid fa-sort-up" style={{ marginLeft: 4, color: "#FF1E00" }}></i>
            : <i className="fa-solid fa-sort-down" style={{ marginLeft: 4, color: "#FF1E00" }}></i>;
    };

    const sortedSeasons = useMemo(() => {
        if (!sortCol) return seasons;
        const sorted = [...seasons].sort((a, b) => {
            if (sortCol === "name") {
                return (a.name || "").localeCompare(b.name || "");
            }
            if (sortCol === "organization") {
                return (a.organization?.name || "").localeCompare(b.organization?.name || "");
            }
            if (sortCol === "isDefault") {
                return (a.isDefault ? 1 : 0) - (b.isDefault ? 1 : 0);
            }
            return 0;
        });
        return sortDir === "desc" ? sorted.reverse() : sorted;
    }, [seasons, sortCol, sortDir]);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [formName, setFormName] = useState("");
    const [formIsDefault, setFormIsDefault] = useState(false);
    const [formOrgId, setFormOrgId] = useState("");
    const [saving, setSaving] = useState(false);

    const isAdmin = user?.role === "admin";
    const canView = hasAnyAccess(user, ["manage_seasons", "season_view", "season_create", "season_update", "season_delete"]);
    const canCreate = hasAnyAccess(user, ["manage_seasons", "season_create"]);
    const canUpdate = hasAnyAccess(user, ["manage_seasons", "season_update"]);
    const canDelete = hasAnyAccess(user, ["manage_seasons", "season_delete"]);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    // Fetch organizations (admin picks; organizer auto-selects)
    useEffect(() => {
        if (!isAdmin) return;
        fetch("/api/organizations")
            .then((r) => r.json())
            .then((d) => { if (d.success) setOrganizations(d.data); })
            .catch(() => {});
    }, [isAdmin]);

    const fetchSeasons = useCallback(async () => {
        if (!canView) { setLoading(false); return; }
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            const res = await fetch(`/api/seasons?${params.toString()}`);
            const data = await res.json();
            if (data.success) setSeasons(data.data);
            else showError(data.error || "Failed to load seasons");
        } catch { showError("Failed to load seasons"); }
        finally { setLoading(false); }
    }, [canView, search, showError]);

    useEffect(() => { fetchSeasons(); }, [fetchSeasons]);

    const userOrgId = user?.organization?.id || user?.organization?._id || "";
    const userOrgName = user?.organization?.name || "";

    const openAdd = () => {
        setEditTarget(null);
        setFormName("");
        setFormIsDefault(false);
        setFormOrgId(isAdmin ? "" : userOrgId);
        setShowForm(true);
    };

    const openEdit = (season) => {
        setEditTarget(season);
        setFormName(season.name);
        setFormIsDefault(season.isDefault || false);
        setFormOrgId(season.organization?._id || season.organization || "");
        setShowForm(true);
    };

    const cancelForm = () => {
        setShowForm(false);
        setEditTarget(null);
    };

    const handleSave = async () => {
        if (!formName.trim()) { showError("Season name is required."); return; }
        if (!formOrgId && !editTarget) { showError("Please select an organization."); return; }
        setSaving(true);
        try {
            if (editTarget) {
                const res = await fetch(`/api/seasons/${editTarget._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: formName.trim(), isDefault: formIsDefault }),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error); setSaving(false); return; }
                showSuccess("Season updated!");
            } else {
                const res = await fetch("/api/seasons", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: formName.trim(), isDefault: formIsDefault, organization: formOrgId }),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error); setSaving(false); return; }
                showSuccess("Season created!");
            }
            cancelForm();
            fetchSeasons();
        } catch { showError("Failed to save season"); }
        finally { setSaving(false); }
    };

    const deleteSeason = async (season) => {
        if (!canDelete) { showError("You do not have permission to delete seasons."); return; }
        if (!confirm(`Delete season "${season.name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/seasons/${season._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            fetchSeasons();
            showSuccess("Season deleted!");
        } catch { showError("Failed to delete season"); }
    };

    return (
        <AdminLayout title="Seasons">
            {!canView ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to view seasons.</p>
                </div>
            ) : (
                <>
                    {/* Add / Edit form */}
                    {showForm && (
                        <div className="admin-card" style={{ marginBottom: 24 }}>
                            <div className="admin-card-header">
                                <h3>{editTarget ? "Edit Season" : "Add Season"}</h3>
                                <button className="admin-btn admin-btn-ghost" onClick={cancelForm}>
                                    <i className="fa-solid fa-xmark"></i> Cancel
                                </button>
                            </div>
                            <div style={{ padding: "20px 24px" }}>
                                {/* Org selector: admin gets dropdown (add only), organizer sees locked name */}
                                {!editTarget && (
                                    <div className="admin-form-group" style={{ maxWidth: 400 }}>
                                        <label className="admin-form-label">Organization *</label>
                                        {isAdmin ? (
                                            <select
                                                className="admin-form-select"
                                                value={formOrgId}
                                                onChange={(e) => setFormOrgId(e.target.value)}
                                            >
                                                <option value="">Select organization...</option>
                                                {organizations.map((o) => (
                                                    <option key={o._id} value={o._id}>{o.name}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                className="admin-form-input"
                                                value={userOrgName}
                                                disabled
                                                style={{ background: "#f3f4f6", color: "#6b7280", cursor: "not-allowed" }}
                                            />
                                        )}
                                    </div>
                                )}
                                <div className="admin-form-group" style={{ maxWidth: 400 }}>
                                    <label className="admin-form-label">Name *</label>
                                    <input
                                        className="admin-form-input"
                                        value={formName}
                                        onChange={(e) => setFormName(e.target.value)}
                                        placeholder="e.g. Fall 2026"
                                    />
                                </div>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Default Season</label>
                                    <div
                                        onClick={() => setFormIsDefault(!formIsDefault)}
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: 10,
                                            cursor: "pointer",
                                            userSelect: "none",
                                        }}
                                    >
                                        <div style={{
                                            width: 44,
                                            height: 24,
                                            borderRadius: 12,
                                            background: formIsDefault ? "#FF1E00" : "#d1d5db",
                                            position: "relative",
                                            transition: "background 0.2s",
                                        }}>
                                            <div style={{
                                                width: 18,
                                                height: 18,
                                                borderRadius: "50%",
                                                background: "#fff",
                                                position: "absolute",
                                                top: 3,
                                                left: formIsDefault ? 23 : 3,
                                                transition: "left 0.2s",
                                                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                                            }} />
                                        </div>
                                        <span style={{ fontSize: 14, color: formIsDefault ? "#FF1E00" : "#8b90a0" }}>
                                            {formIsDefault ? "Yes" : "No"}
                                        </span>
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                                    <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
                                        {saving ? "Saving..." : editTarget ? "Update" : "Save"}
                                    </button>
                                    <button className="admin-btn admin-btn-ghost" onClick={cancelForm}>Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Seasons list */}
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3>Seasons ({seasons.length})</h3>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <input
                                    className="admin-form-input"
                                    placeholder="Search..."
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    style={{ width: 200, height: 36, fontSize: 13 }}
                                />
                                {canCreate && !showForm && (
                                    <button className="admin-btn admin-btn-primary" onClick={openAdd}>
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
                                <p>No seasons found.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("name")}>
                                                Name {sortIcon("name")}
                                            </th>
                                            {isAdmin && (
                                                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("organization")}>
                                                    Organization {sortIcon("organization")}
                                                </th>
                                            )}
                                            <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("isDefault")}>
                                                Default Season {sortIcon("isDefault")}
                                            </th>
                                            <th style={{ width: 120 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedSeasons.map((season) => (
                                            <tr key={season._id}>
                                                <td style={{ fontWeight: 600 }}>{season.name}</td>
                                                {isAdmin && (
                                                    <td style={{ color: "#5a5f72" }}>
                                                        {season.organization?.name || "-"}
                                                    </td>
                                                )}
                                                <td>
                                                    <span style={{ color: season.isDefault ? "#FF1E00" : "#8b90a0", fontWeight: 600 }}>
                                                        {season.isDefault ? "Yes" : "No"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        {canUpdate && (
                                                            <button
                                                                className="admin-btn admin-btn-ghost admin-btn-sm"
                                                                onClick={() => openEdit(season)}
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
                </>
            )}
        </AdminLayout>
    );
}
