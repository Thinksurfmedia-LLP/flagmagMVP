"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import ConfirmModal from "@/components/ConfirmModal";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";
import { uploadImage } from "@/lib/uploadImage";

export default function StoreCategoriesPage() {
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();

    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [formName, setFormName] = useState("");
    const [formImage, setFormImage] = useState("");
    const [formSort, setFormSort] = useState("0");
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    // Delete state
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const isAdmin = user?.role === "admin";

    const fetchCategories = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/store/categories");
            const data = await res.json();
            if (data.success) setCategories(data.data || []);
            else showError(data.error || "Failed to load categories");
        } catch { showError("Failed to load categories"); } finally { setLoading(false); }
    }, [showError]);

    useEffect(() => { fetchCategories(); }, [fetchCategories]);

    const filtered = useMemo(() => {
        if (!search) return categories;
        const s = search.toLowerCase();
        return categories.filter(c => (c.name || "").toLowerCase().includes(s));
    }, [categories, search]);

    const openCreate = () => {
        setEditTarget(null);
        setFormName("");
        setFormImage("");
        setFormSort("0");
        setShowForm(true);
    };

    const openEdit = (category) => {
        setEditTarget(category);
        setFormName(category.name);
        setFormImage(category.image || "");
        setFormSort(String(category.sortOrder ?? 0));
        setShowForm(true);
    };

    const closeForm = () => { setShowForm(false); setEditTarget(null); };

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingImage(true);
        try {
            setFormImage(await uploadImage(file));
        } catch (err) { showError(err.message); }
        finally { setUploadingImage(false); }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formName.trim()) { showError("Name is required"); return; }
        const sortOrder = Number(formSort);
        if (!Number.isInteger(sortOrder)) { showError("Sort order must be a whole number"); return; }
        setSaving(true);
        try {
            const url = editTarget ? `/api/store/categories/${editTarget._id}` : "/api/store/categories";
            const res = await fetch(url, {
                method: editTarget ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: formName.trim(), image: formImage, sortOrder }),
            });
            const data = await res.json();
            if (data.success) {
                showSuccess(editTarget ? "Category updated" : "Category created");
                closeForm();
                fetchCategories();
            } else {
                showError(data.error || "Save failed");
            }
        } catch { showError("Save failed"); } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/store/categories/${deleteTarget._id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                showSuccess("Category deleted");
                fetchCategories();
            } else {
                showError(data.error || "Delete failed");
            }
        } catch { showError("Delete failed"); } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    if (!isAdmin) {
        return (
            <AdminLayout title="Store Categories">
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage store categories.</p>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Store Categories">
            {showForm && (
                <div className="admin-card" style={{ marginBottom: 24 }}>
                    <div className="admin-card-header">
                        <h3>{editTarget ? "Edit Category" : "Add Category"}</h3>
                        <button className="admin-btn admin-btn-ghost" onClick={closeForm}>
                            <i className="fa-solid fa-xmark"></i> Cancel
                        </button>
                    </div>
                    <div style={{ padding: "20px 24px" }}>
                        <form onSubmit={handleSave}>
                            <div className="admin-form-group" style={{ maxWidth: 400 }}>
                                <label className="admin-form-label">Name *</label>
                                <input className="admin-form-input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. Apparel" required />
                            </div>
                            <div className="admin-form-group" style={{ maxWidth: 400 }}>
                                <label className="admin-form-label">Sort order</label>
                                <input className="admin-form-input" type="number" step="1" value={formSort} onChange={e => setFormSort(e.target.value)} />
                            </div>
                            <div className="admin-form-group" style={{ maxWidth: 400 }}>
                                <label className="admin-form-label">Image</label>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                    {formImage && <img src={formImage} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4 }} />}
                                    <label className="admin-btn admin-btn-ghost" style={{ cursor: "pointer", marginBottom: 0 }}>
                                        <i className="fa-solid fa-upload"></i>
                                        {uploadingImage ? "Uploading..." : "Upload Image"}
                                        <input type="file" accept="image/*" onChange={handleUpload} hidden disabled={uploadingImage} />
                                    </label>
                                    {formImage && (
                                        <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => setFormImage("")}>Remove</button>
                                    )}
                                </div>
                                <div style={{ marginTop: 6, fontSize: 12, color: "#dc2626" }}>Max file size: 1MB</div>
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
                                <button type="submit" className="admin-btn admin-btn-primary" disabled={saving || uploadingImage}>
                                    {saving ? "Saving..." : editTarget ? "Update Category" : "Create Category"}
                                </button>
                                <button type="button" className="admin-btn admin-btn-ghost" onClick={closeForm}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="admin-card">
                <div className="admin-card-header">
                    <h3>Categories ({filtered.length})</h3>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                            className="admin-form-input"
                            placeholder="Search..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            style={{ width: 200, height: 36, fontSize: 13 }}
                        />
                        {!showForm && (
                            <button className="admin-btn admin-btn-primary" onClick={openCreate}>
                                <i className="fa-solid fa-plus"></i> Add Category
                            </button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="admin-loading"><div className="admin-spinner"></div>Loading categories...</div>
                ) : filtered.length === 0 ? (
                    <div className="admin-empty">
                        <i className="fa-solid fa-tags"></i>
                        <p>No categories found.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 70 }}>Image</th>
                                    <th>Name</th>
                                    <th>Slug</th>
                                    <th style={{ width: 100 }}>Sort order</th>
                                    <th style={{ width: 120 }}>Active products</th>
                                    <th style={{ width: 120 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(category => (
                                    <tr key={category._id}>
                                        <td>
                                            {category.image ? (
                                                <img src={category.image} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }} />
                                            ) : (
                                                <span style={{ color: "#bbb" }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ fontWeight: 600 }}>{category.name}</td>
                                        <td>{category.slug}</td>
                                        <td>{category.sortOrder}</td>
                                        <td>{category.activeCount ?? 0}</td>
                                        <td>
                                            <div style={{ display: "flex", gap: 6 }}>
                                                <button className="admin-btn admin-btn-ghost admin-btn-sm" title="Edit" onClick={() => openEdit(category)}>
                                                    <i className="fa-solid fa-pen"></i>
                                                </button>
                                                <button className="admin-btn admin-btn-danger admin-btn-sm" title="Delete" onClick={() => setDeleteTarget(category)}>
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

            <ConfirmModal
                open={!!deleteTarget}
                title="Delete category?"
                message={deleteTarget ? `"${deleteTarget.name}" will be permanently deleted.` : ""}
                confirming={deleting}
                onConfirm={handleDelete}
                onCancel={() => !deleting && setDeleteTarget(null)}
            />
        </AdminLayout>
    );
}
