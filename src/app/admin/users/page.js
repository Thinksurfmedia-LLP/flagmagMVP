"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

function AddUserModal({ onClose, onSave, organizations, roles, isAdmin }) {
    const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "", role: "viewer", organization: "" });
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [formError, setFormError] = useState("");

    const selectedRole = roles.find(r => r.slug === form.role);
    const availableRoles = isAdmin ? roles : roles.filter(r => !["admin", "organizer"].includes(r.slug));
    const needsOrg = isAdmin && selectedRole?.slug === "organizer";

    const handleSave = async () => {
        setFormError("");
        if (needsOrg && !form.organization) {
            setFormError("Please select an organization for the organizer");
            return;
        }
        if (form.password !== form.confirmPassword) {
            setFormError("Passwords do not match");
            return;
        }
        setSaving(true);
        await onSave(form);
        setSaving(false);
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <h3 className="admin-modal-title">Add New User</h3>

                {formError && <div className="admin-alert admin-alert-error" style={{ marginBottom: 12 }}><i className="fa-solid fa-exclamation-circle"></i> {formError}</div>}

                <div className="admin-form-group">
                    <label className="admin-form-label">Name *</label>
                    <input className="admin-form-input" autoComplete="off" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Email *</label>
                    <input type="email" className="admin-form-input" autoComplete="off" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Phone</label>
                    <input className="admin-form-input" autoComplete="off" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1-555-0000" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Password *</label>
                    <div style={{ position: "relative" }}>
                        <input type={showPassword ? "text" : "password"} className="admin-form-input" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" style={{ paddingRight: 36 }} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8b90a0", fontSize: 14 }}>
                            <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                        </button>
                    </div>
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Confirm Password *</label>
                    <div style={{ position: "relative" }}>
                        <input type={showConfirm ? "text" : "password"} className="admin-form-input" autoComplete="new-password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Re-enter password" style={{ paddingRight: 36 }} />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8b90a0", fontSize: 14 }}>
                            <i className={`fa-solid ${showConfirm ? "fa-eye-slash" : "fa-eye"}`}></i>
                        </button>
                    </div>
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Role *</label>
                    <select className="admin-form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value, ...(!roles.find(r => r.slug === e.target.value && r.slug === "organizer") ? { organization: "" } : {}) })}>
                        {availableRoles.map(r => (
                            <option key={r._id} value={r.slug}>{r.name}</option>
                        ))}
                    </select>
                    {!isAdmin && <p style={{ fontSize: 12, color: "#8b90a0", marginTop: 6 }}>User will be automatically added to your organization.</p>}
                </div>
                {needsOrg && (
                    <div className="admin-form-group">
                        <label className="admin-form-label">Organization *</label>
                        <select className="admin-form-select" value={form.organization} onChange={e => setForm({ ...form, organization: e.target.value })}>
                            <option value="">— Select Organization —</option>
                            {(organizations || []).map(o => (
                                <option key={o._id} value={o._id}>{o.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? "Creating..." : "Create User"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function EditUserModal({ target, onClose, onSave, organizations, roles, isAdmin }) {
    const [role, setRole] = useState(target.role);
    const [organization, setOrganization] = useState(target.organization?._id || target.organization || "");
    const [saving, setSaving] = useState(false);

    const needsOrg = isAdmin && role === "organizer";

    const handleSave = async () => {
        setSaving(true);
        await onSave(target._id, { role, organization: needsOrg ? organization : null });
        setSaving(false);
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <h3 className="admin-modal-title">Edit User — {target.name}</h3>

                <div className="admin-form-group">
                    <label className="admin-form-label">Role</label>
                    <select className="admin-form-select" value={role} onChange={e => { setRole(e.target.value); if (e.target.value !== "organizer") setOrganization(""); }}>
                        {(isAdmin ? roles : roles.filter(r => !["admin", "organizer"].includes(r.slug))).map(r => (
                            <option key={r._id} value={r.slug}>{r.name}</option>
                        ))}
                    </select>
                </div>

                {needsOrg && (
                    <div className="admin-form-group">
                        <label className="admin-form-label">Organization *</label>
                        <select className="admin-form-select" value={organization} onChange={e => setOrganization(e.target.value)}>
                            <option value="">— Select Organization —</option>
                            {(organizations || []).map(o => (
                                <option key={o._id} value={o._id}>{o.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div style={{ marginTop: 12, fontSize: 12, color: "#8b90a0" }}>
                    Permissions are managed in the <strong>Roles</strong> page.
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminUsersPage() {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editTarget, setEditTarget] = useState(null);
    const [search, setSearch] = useState("");
    const [showAddUser, setShowAddUser] = useState(false);
    const [organizations, setOrganizations] = useState([]);
    const [roles, setRoles] = useState([]);
    const { showSuccess, showError } = useToast();

    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/users");
            const data = await res.json();
            if (data.success) setUsers(data.data);
            else showError(data.error);
        } catch {
            showError("Failed to load users");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    useEffect(() => {
        fetch("/api/organizations").then(r => r.json()).then(d => {
            if (d.success) setOrganizations(d.data);
        }).catch(() => {});
        fetch("/api/admin/roles").then(r => r.json()).then(d => {
            if (d.success) setRoles(d.data);
        }).catch(() => {});
    }, []);

    const handleSave = async (userId, updates) => {
        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            setEditTarget(null);
            fetchUsers();
            showSuccess("User updated successfully!");
        } catch {
            showError("Failed to update user");
        }
    };

    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase())
    );

    const toggleActive = async (userId, currentActive) => {
        try {
            const res = await fetch(`/api/admin/users/${userId}`, { method: "PATCH" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            fetchUsers();
            showSuccess(currentActive === false ? "User activated!" : "User deactivated!");
        } catch {
            showError("Failed to update user status");
        }
    };

    const deleteUser = async (userId, name) => {
        if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            fetchUsers();
            showSuccess("User deleted!");
        } catch {
            showError("Failed to delete user");
        }
    };

    const canManage = user && hasAccess(user, "manage_users");

    return (
        <AdminLayout title="Users">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage users.</p>
                </div>
            ) : (
                <>
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3>All Users ({filtered.length})</h3>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    placeholder="Search users..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    autoComplete="off"
                                    style={{ maxWidth: 260 }}
                                />
                                {canManage && (
                                    <button className="admin-btn admin-btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => { setSearch(""); setShowAddUser(true); }}>
                                        <i className="fa-solid fa-plus"></i> Add User
                                    </button>
                                )}
                            </div>
                        </div>
                        {loading ? (
                            <div className="admin-loading">
                                <div className="admin-spinner"></div>
                                Loading users...
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-user-slash"></i>
                                <p>No users found.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Organization</th>
                                            <th>Role</th>
                                            <th>Joined</th>
                                            <th>Status</th>
                                            <th style={{ width: 160 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(u => (
                                            <tr key={u._id} style={{ opacity: u.isActive === false ? 0.5 : 1 }}>
                                                <td style={{ fontWeight: 600 }}>
                                                    {u.name}
                                                    {u.isActive === false && <span className="admin-badge" style={{ marginLeft: 8, background: "#fee2e2", color: "#dc2626" }}>Inactive</span>}
                                                </td>
                                                <td style={{ color: "#5a5f72" }}>{u.email}</td>
                                                <td style={{ color: "#5a5f72", fontSize: 13 }}>
                                                    {u.organization ? u.organization.name : <span style={{ color: "#a0a4b2" }}>—</span>}
                                                </td>
                                                <td>
                                                    <span className={`admin-badge ${u.role}`}>{u.role}</span>
                                                </td>
                                                <td style={{ color: "#8b90a0", fontSize: 13 }}>
                                                    {new Date(u.createdAt).toLocaleDateString()}
                                                </td>
                                                <td>
                                                    <span className={`admin-badge ${u.isActive === false ? "" : "player"}`}>
                                                        {u.isActive === false ? "Inactive" : "Active"}
                                                    </span>
                                                </td>
                                                <td>
                                                    {canManage && u._id !== user.id && (
                                                        <div style={{ display: "flex", gap: 6 }}>
                                                            <button
                                                                className="admin-btn admin-btn-ghost admin-btn-sm"
                                                                onClick={() => setEditTarget(u)}
                                                                title="Edit role & permissions"
                                                            >
                                                                <i className="fa-solid fa-pen"></i>
                                                            </button>
                                                            <button
                                                                className={`admin-btn admin-btn-sm ${u.isActive === false ? "admin-btn-primary" : "admin-btn-ghost"}`}
                                                                onClick={() => toggleActive(u._id, u.isActive)}
                                                                title={u.isActive === false ? "Activate user" : "Deactivate user"}
                                                            >
                                                                <i className={`fa-solid ${u.isActive === false ? "fa-toggle-off" : "fa-toggle-on"}`}></i>
                                                            </button>
                                                            <button
                                                                className="admin-btn admin-btn-danger admin-btn-sm"
                                                                onClick={() => deleteUser(u._id, u.name)}
                                                                title="Delete user"
                                                            >
                                                                <i className="fa-solid fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    )}
                                                    {canManage && u._id === user.id && (
                                                        <span style={{ fontSize: 12, color: "#8b90a0" }}>You</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {editTarget && (
                        <EditUserModal
                            target={editTarget}
                            onClose={() => setEditTarget(null)}
                            onSave={handleSave}
                            organizations={organizations}
                            roles={roles}
                            isAdmin={user?.role === "admin"}
                        />
                    )}

                    {showAddUser && (
                        <AddUserModal
                            organizations={organizations}
                            roles={roles}
                            onClose={() => setShowAddUser(false)}
                            isAdmin={user?.role === "admin"}
                            onSave={async (formData) => {
                                try {
                                    const res = await fetch("/api/admin/users", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify(formData),
                                    });
                                    const data = await res.json();
                                    if (!data.success) { showError(data.error); return; }
                                    setShowAddUser(false);
                                    fetchUsers();
                                    showSuccess("User created successfully!");
                                } catch {
                                    showError("Failed to create user");
                                }
                            }}
                        />
                    )}
                </>
            )}
        </AdminLayout>
    );
}
