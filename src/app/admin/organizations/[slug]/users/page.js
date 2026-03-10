"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";
import { useToast } from "@/components/AdminToast";

function AddUserModal({ onClose, onSave, roles }) {
    const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "", role: "player" });
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [formError, setFormError] = useState("");

    const handleSave = async () => {
        setFormError("");
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
                    <select className="admin-form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                        {roles.map(r => (
                            <option key={r._id} value={r.slug}>{r.name}</option>
                        ))}
                    </select>
                </div>
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

function EditUserModal({ target, onClose, onSave, roles }) {
    const [role, setRole] = useState(target.role);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        await onSave(target._id, { role });
        setSaving(false);
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <h3 className="admin-modal-title">Edit User — {target.name}</h3>
                <div className="admin-form-group">
                    <label className="admin-form-label">Role</label>
                    <select className="admin-form-select" value={role} onChange={e => setRole(e.target.value)}>
                        {roles.map(r => (
                            <option key={r._id} value={r.slug}>{r.name}</option>
                        ))}
                    </select>
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

export default function OrgUsersPage() {
    const { slug } = useParams();
    const { user } = useAuth();
    const { org: impersonatedOrg, enterImpersonation } = useImpersonation();
    const { showSuccess, showError } = useToast();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editTarget, setEditTarget] = useState(null);
    const [search, setSearch] = useState("");
    const [showAddUser, setShowAddUser] = useState(false);
    const [roles, setRoles] = useState([]);

    // Re-hydrate impersonation if page refreshed directly
    useEffect(() => {
        if (!impersonatedOrg && slug) {
            fetch(`/api/organizations/${slug}`)
                .then(r => r.json())
                .then(d => { if (d.success) enterImpersonation(d.data); })
                .catch(() => {});
        }
    }, [slug, impersonatedOrg, enterImpersonation]);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch(`/api/organizations/${slug}/users`);
            const data = await res.json();
            if (data.success) setUsers(data.data);
            else showError(data.error);
        } catch { showError("Failed to load users"); }
        finally { setLoading(false); }
    }, [slug]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    useEffect(() => {
        // Load roles but exclude admin (organizers can't assign admin)
        fetch("/api/admin/roles").then(r => r.json()).then(d => {
            if (d.success) setRoles(d.data.filter(r => r.slug !== "admin"));
        }).catch(() => {});
    }, []);

    const handleSave = async (userId, updates) => {
        try {
            const res = await fetch(`/api/organizations/${slug}/users/${userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            setEditTarget(null);
            fetchUsers();
            showSuccess("User updated successfully!");
        } catch { showError("Failed to update user"); }
    };

    const toggleActive = async (userId, currentActive) => {
        try {
            const res = await fetch(`/api/organizations/${slug}/users/${userId}`, { method: "PATCH" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            fetchUsers();
            showSuccess(currentActive === false ? "User activated!" : "User deactivated!");
        } catch { showError("Failed to update user status"); }
    };

    const deleteUser = async (userId, name) => {
        if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/organizations/${slug}/users/${userId}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            fetchUsers();
            showSuccess("User deleted!");
        } catch { showError("Failed to delete user"); }
    };

    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase())
    );

    const canManage = user && hasAccess(user, "manage_users");
    const orgName = impersonatedOrg?.name || slug;

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
                            <h3>{orgName} — Users ({filtered.length})</h3>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <input type="text" className="admin-form-input" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" style={{ maxWidth: 260 }} />
                                <button className="admin-btn admin-btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => { setSearch(""); setShowAddUser(true); }}>
                                    <i className="fa-solid fa-plus"></i> Add User
                                </button>
                            </div>
                        </div>
                        {loading ? (
                            <div className="admin-loading"><div className="admin-spinner"></div>Loading users...</div>
                        ) : filtered.length === 0 ? (
                            <div className="admin-empty"><i className="fa-solid fa-user-slash"></i><p>No users found.</p></div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table className="admin-table">
                                    <thead><tr>
                                        <th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th>Status</th><th style={{ width: 160 }}>Actions</th>
                                    </tr></thead>
                                    <tbody>
                                        {filtered.map(u => (
                                            <tr key={u._id} style={{ opacity: u.isActive === false ? 0.5 : 1 }}>
                                                <td style={{ fontWeight: 600 }}>
                                                    {u.name}
                                                    {u.isActive === false && <span className="admin-badge" style={{ marginLeft: 8, background: "#fee2e2", color: "#dc2626" }}>Inactive</span>}
                                                </td>
                                                <td style={{ color: "#5a5f72" }}>{u.email}</td>
                                                <td><span className={`admin-badge ${u.role}`}>{u.role}</span></td>
                                                <td style={{ color: "#8b90a0", fontSize: 13 }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                                                <td><span className={`admin-badge ${u.isActive === false ? "" : "player"}`}>{u.isActive === false ? "Inactive" : "Active"}</span></td>
                                                <td>
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setEditTarget(u)} title="Edit role">
                                                            <i className="fa-solid fa-pen"></i>
                                                        </button>
                                                        <button className={`admin-btn admin-btn-sm ${u.isActive === false ? "admin-btn-primary" : "admin-btn-ghost"}`} onClick={() => toggleActive(u._id, u.isActive)} title={u.isActive === false ? "Activate user" : "Deactivate user"}>
                                                            <i className={`fa-solid ${u.isActive === false ? "fa-toggle-off" : "fa-toggle-on"}`}></i>
                                                        </button>
                                                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteUser(u._id, u.name)} title="Delete user">
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
                    {editTarget && <EditUserModal target={editTarget} onClose={() => setEditTarget(null)} onSave={handleSave} roles={roles} />}
                    {showAddUser && (
                        <AddUserModal roles={roles} onClose={() => setShowAddUser(false)}
                            onSave={async (formData) => {
                                try {
                                    const res = await fetch(`/api/organizations/${slug}/users`, {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify(formData),
                                    });
                                    const data = await res.json();
                                    if (!data.success) { showError(data.error); return; }
                                    setShowAddUser(false);
                                    fetchUsers();
                                    showSuccess("User created successfully!");
                                } catch { showError("Failed to create user"); }
                            }}
                        />
                    )}
                </>
            )}
        </AdminLayout>
    );
}
