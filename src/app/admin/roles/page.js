"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout, { hasAccess, ALL_PERMISSIONS } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

const PERM_LABELS = {
    manage_organizations: "Organizations",
    manage_seasons: "Seasons",
    manage_games: "Games",
    manage_players: "Players",
    manage_users: "Users",
    view_dashboard: "Dashboard",
};

export default function AdminRolesPage() {
    const { user } = useAuth();
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState(null);
    const [editPerms, setEditPerms] = useState([]);
    const [newName, setNewName] = useState("");
    const [newPerms, setNewPerms] = useState([]);
    const [showAdd, setShowAdd] = useState(false);
    const { showSuccess, showError } = useToast();

    const fetchRoles = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/roles");
            const data = await res.json();
            if (data.success) setRoles(data.data);
            else showError(data.error);
        } catch {
            showError("Failed to load roles");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRoles(); }, [fetchRoles]);

    const startEdit = (role) => {
        setEditId(role._id);
        setEditPerms([...role.permissions]);
    };

    const cancelEdit = () => {
        setEditId(null);
        setEditPerms([]);
    };

    const toggleEditPerm = (perm) => {
        setEditPerms(prev =>
            prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
        );
    };

    const toggleNewPerm = (perm) => {
        setNewPerms(prev =>
            prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
        );
    };

    const saveEdit = async () => {
        try {
            const res = await fetch(`/api/admin/roles/${editId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ permissions: editPerms }),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            setEditId(null);
            fetchRoles();
            showSuccess("Role updated!");
        } catch {
            showError("Failed to update role");
        }
    };

    const addRole = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        try {
            const res = await fetch("/api/admin/roles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName.trim(), permissions: newPerms }),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            setNewName("");
            setNewPerms([]);
            setShowAdd(false);
            fetchRoles();
            showSuccess("Role created!");
        } catch {
            showError("Failed to create role");
        }
    };

    const deleteRole = async (id, name) => {
        if (!confirm(`Delete role "${name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/admin/roles/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            fetchRoles();
            showSuccess("Role deleted!");
        } catch {
            showError("Failed to delete role");
        }
    };

    const canManage = user && hasAccess(user, "manage_users");

    return (
        <AdminLayout title="Roles">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage roles.</p>
                </div>
            ) : (
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3>All Roles ({roles.length})</h3>
                        {user?.role === "admin" && !showAdd && (
                            <button className="admin-btn admin-btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => setShowAdd(true)}>
                                <i className="fa-solid fa-plus"></i> Add Role
                            </button>
                        )}
                    </div>

                    {showAdd && (
                        <div className="admin-card-body" style={{ borderBottom: "1px solid #e8eaef" }}>
                            <form onSubmit={addRole}>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Role Name *</label>
                                    <input className="admin-form-input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Scorekeeper" required style={{ maxWidth: 300 }} />
                                </div>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Permissions</label>
                                    <div className="admin-perm-grid">
                                        {ALL_PERMISSIONS.map(perm => (
                                            <label key={perm} className="admin-perm-item">
                                                <input type="checkbox" checked={newPerms.includes(perm)} onChange={() => toggleNewPerm(perm)} />
                                                {PERM_LABELS[perm] || perm}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button type="submit" className="admin-btn admin-btn-primary">Create Role</button>
                                    <button type="button" className="admin-btn admin-btn-ghost" onClick={() => { setShowAdd(false); setNewName(""); setNewPerms([]); }}>Cancel</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {loading ? (
                        <div className="admin-loading">
                            <div className="admin-spinner"></div>
                            Loading roles...
                        </div>
                    ) : roles.length === 0 ? (
                        <div className="admin-empty">
                            <i className="fa-solid fa-shield-halved"></i>
                            <p>No roles found.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Role</th>
                                        <th>Permissions</th>
                                        <th style={{ width: 120 }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {roles.map(r => (
                                        <tr key={r._id}>
                                            <td style={{ fontWeight: 600 }}>
                                                {r.name}
                                                {r.isSystem && <span className="admin-badge" style={{ marginLeft: 8, background: "rgba(255,30,0,0.08)", color: "#FF1E00", fontSize: 10 }}>System</span>}
                                            </td>
                                            <td>
                                                {editId === r._id ? (
                                                    <div>
                                                        <div className="admin-perm-grid">
                                                            {ALL_PERMISSIONS.map(perm => (
                                                                <label key={perm} className="admin-perm-item">
                                                                    <input type="checkbox" checked={editPerms.includes(perm)} onChange={() => toggleEditPerm(perm)} />
                                                                    {PERM_LABELS[perm] || perm}
                                                                </label>
                                                            ))}
                                                        </div>
                                                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                                            <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={saveEdit}>Save</button>
                                                            <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={cancelEdit}>Cancel</button>
                                                        </div>
                                                    </div>
                                                ) : r.permissions.length > 0 ? (
                                                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                                        {r.permissions.map(p => (
                                                            <span key={p} style={{
                                                                fontSize: 11,
                                                                padding: "2px 8px",
                                                                borderRadius: 4,
                                                                background: "rgba(255,30,0,0.08)",
                                                                color: "#FF1E00",
                                                            }}>
                                                                {PERM_LABELS[p] || p}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: 12, color: "#a0a4b2" }}>None</span>
                                                )}
                                            </td>
                                            <td>
                                                {editId !== r._id && user?.role === "admin" && (
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        <button
                                                            className="admin-btn admin-btn-ghost admin-btn-sm"
                                                            onClick={() => startEdit(r)}
                                                            title="Edit permissions"
                                                        >
                                                            <i className="fa-solid fa-pen"></i>
                                                        </button>
                                                        {!r.isSystem && (
                                                            <button
                                                                className="admin-btn admin-btn-danger admin-btn-sm"
                                                                onClick={() => deleteRole(r._id, r.name)}
                                                                title="Delete role"
                                                            >
                                                                <i className="fa-solid fa-trash"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </AdminLayout>
    );
}
