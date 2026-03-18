"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

export default function AmenitiesPage() {
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();

    const [amenities, setAmenities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [formName, setFormName] = useState("");
    const [formIcon, setFormIcon] = useState("");
    const [saving, setSaving] = useState(false);
    const [uploadingIcon, setUploadingIcon] = useState(false);

    const isAdmin = user?.role === "admin";

    const fetchAmenities = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/amenities");
            const data = await res.json();
            if (data.success) setAmenities(data.data || []);
        } catch { /* ignore */ } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchAmenities(); }, [fetchAmenities]);

    const filtered = useMemo(() => {
        if (!search) return amenities;
        const s = search.toLowerCase();
        return amenities.filter(a => (a.name || "").toLowerCase().includes(s));
    }, [amenities, search]);

    const openCreate = () => {
        setEditTarget(null);
        setFormName("");
        setFormIcon("");
        setShowForm(true);
    };

    const openEdit = (amenity) => {
        setEditTarget(amenity);
        setFormName(amenity.name);
        setFormIcon(amenity.icon || "");
        setShowForm(true);
    };

    const closeForm = () => { setShowForm(false); setEditTarget(null); };

    const uploadIcon = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingIcon(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: formData });
            const data = await res.json();
            if (data.url) setFormIcon(data.url);
            else showError("Upload failed");
        } catch { showError("Upload failed"); }
        finally { setUploadingIcon(false); }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formName.trim()) { showError("Name is required"); return; }
        setSaving(true);
        try {
            const url = editTarget ? `/api/amenities/${editTarget._id}` : "/api/amenities";
            const method = editTarget ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: formName.trim(), icon: formIcon }),
            });
            const data = await res.json();
            if (data.success) {
                showSuccess(editTarget ? "Amenity updated" : "Amenity created");
                closeForm();
                fetchAmenities();
            } else {
                showError(data.error || "Save failed");
            }
        } catch { showError("Save failed"); } finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this amenity?")) return;
        try {
            const res = await fetch(`/api/amenities/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) { showSuccess("Amenity deleted"); fetchAmenities(); }
            else showError(data.error || "Delete failed");
        } catch { showError("Delete failed"); }
    };

    if (!isAdmin) {
        return (
            <AdminLayout title="Amenities">
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage amenities.</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Amenities">
            {/* Inline Add/Edit Form */}
            {showForm && (
                <div className="admin-card" style={{ marginBottom: 24 }}>
                    <div className="admin-card-header">
                        <h3>{editTarget ? "Edit Amenity" : "Add Amenity"}</h3>
                        <button className="admin-btn admin-btn-ghost" onClick={closeForm}>
                            <i className="fa-solid fa-xmark"></i> Cancel
                        </button>
                    </div>
                    <div style={{ padding: "20px 24px" }}>
                        <form onSubmit={handleSave}>
                            <div className="admin-form-group" style={{ maxWidth: 400 }}>
                                <label className="admin-form-label">Name *</label>
                                <input className="admin-form-input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Parking availability" required />
                            </div>
                            <div className="admin-form-group" style={{ maxWidth: 400 }}>
                                <label className="admin-form-label">Icon</label>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    {formIcon && <img src={formIcon} alt="" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 4 }} />}
                                    <label className="admin-btn admin-btn-ghost" style={{ cursor: "pointer", marginBottom: 0 }}>
                                        <i className="fa-solid fa-upload"></i>
                                        {uploadingIcon ? "Uploading..." : "Upload Icon"}
                                        <input type="file" accept="image/*" onChange={uploadIcon} hidden disabled={uploadingIcon} />
                                    </label>
                                    {formIcon && (
                                        <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setFormIcon("")}>Remove</button>
                                    )}
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                                <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                                    {saving ? "Saving..." : editTarget ? "Update Amenity" : "Create Amenity"}
                                </button>
                                <button type="button" className="admin-btn admin-btn-ghost" onClick={closeForm}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Amenities List */}
            <div className="admin-card">
                <div className="admin-card-header">
                    <h3>Amenities ({filtered.length})</h3>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                            className="admin-form-input"
                            placeholder="Search..."
                            value={searchInput}
                            onChange={e => { setSearchInput(e.target.value); setSearch(e.target.value); }}
                            style={{ width: 200, height: 36, fontSize: 13 }}
                        />
                        {!showForm && (
                            <button className="admin-btn admin-btn-primary" onClick={openCreate}>
                                <i className="fa-solid fa-plus"></i> Add Amenity
                            </button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="admin-loading"><div className="admin-spinner"></div>Loading amenities...</div>
                ) : filtered.length === 0 ? (
                    <div className="admin-empty">
                        <i className="fa-solid fa-list-check"></i>
                        <p>No amenities found.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }}>Icon</th>
                                    <th>Name</th>
                                    <th style={{ width: 120 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(amenity => (
                                    <tr key={amenity._id}>
                                        <td>
                                            {amenity.icon ? (
                                                <img src={amenity.icon} alt="" style={{ width: 28, height: 28, objectFit: "contain" }} />
                                            ) : (
                                                <span style={{ color: "#bbb" }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{amenity.name}</td>
                                        <td>
                                            <div style={{ display: "flex", gap: 6 }}>
                                                <button className="admin-btn admin-btn-ghost admin-btn-sm" title="Edit" onClick={() => openEdit(amenity)}>
                                                    <i className="fa-solid fa-pen"></i>
                                                </button>
                                                <button className="admin-btn admin-btn-danger admin-btn-sm" title="Delete" onClick={() => handleDelete(amenity._id)}>
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
        </AdminLayout>
    );
}
