"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";
import Select from "react-select";

function AddUserModal({ onClose, onSave, organizations, roles, isAdmin }) {
    const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
    const [roleOrganizations, setRoleOrganizations] = useState({});
    const [selectedRoles, setSelectedRoles] = useState(isAdmin ? [] : ["free_agent"]);
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [formError, setFormError] = useState("");

    // Admin: elevated roles only — viewer is assigned by default to all users
    // Organizer: only free_agent
    const availableRoles = isAdmin
        ? roles.filter(r => r.slug !== "player" && r.slug !== "viewer" && r.slug !== "admin")
        : roles.filter(r => r.slug === "free_agent");

    const toggleRole = (slug) => {
        setSelectedRoles(prev =>
            prev.includes(slug) ? prev.filter(r => r !== slug) : [...prev, slug]
        );
    };

    const handleSave = async () => {
        setFormError("");
        if (form.password !== form.confirmPassword) { setFormError("Passwords do not match"); return; }
        const effectiveRoles = [...new Set([...(selectedRoles.length > 0 ? selectedRoles : []), "viewer"])];

        if (isAdmin) {
             for (const r of effectiveRoles) {
                  if (!["admin", "viewer", "player"].includes(r)) {
                       if (!roleOrganizations[r] || roleOrganizations[r].length === 0) {
                           setFormError(`Please select at least one organization for the ${r.replace(/_/g, " ")} role`);
                           return;
                       }
                  }
             }
        }

        setSaving(true);
        await onSave({ ...form, roles: effectiveRoles, role: effectiveRoles[0], roleOrganizations });
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
                    <label className="admin-form-label">Role <span style={{ fontWeight: 400, color: "#8b90a0" }}>(optional — Viewer by default)</span></label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                        {availableRoles.map(r => (
                            <label key={r._id} style={{
                                display: "flex", alignItems: "center", gap: 6,
                                padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                                border: `1.5px solid ${selectedRoles.includes(r.slug) ? "#6366f1" : "#d1d5db"}`,
                                background: selectedRoles.includes(r.slug) ? "rgba(99,102,241,0.1)" : "#f9fafb",
                                color: selectedRoles.includes(r.slug) ? "#6366f1" : "#374151",
                                fontSize: 13, fontWeight: 500, userSelect: "none", transition: "all 0.15s",
                            }}>
                                <input
                                    type="checkbox"
                                    checked={selectedRoles.includes(r.slug)}
                                    onChange={() => toggleRole(r.slug)}
                                    style={{ display: "none" }}
                                />
                                {selectedRoles.includes(r.slug) && <i className="fa-solid fa-check" style={{ fontSize: 11 }}></i>}
                                {r.name || r.slug.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                            </label>
                        ))}
                    </div>
                    {!isAdmin && <p style={{ fontSize: 12, color: "#8b90a0", marginTop: 6 }}>User will be automatically added to your organization.</p>}
                </div>
                {isAdmin && selectedRoles.filter(r => !["admin", "viewer", "player"].includes(r)).map(roleSlug => {
                    const roleName = roles.find(r => r.slug === roleSlug)?.name || roleSlug.replace(/_/g, " ");
                    const currentSelected = roleOrganizations[roleSlug] || [];
                    const selectOptions = (organizations || []).map(o => ({ value: o._id, label: o.name }));
                    const selectValue = selectOptions.filter(o => currentSelected.includes(o.value));
                    
                    return (
                        <div className="admin-form-group" key={roleSlug}>
                            <label className="admin-form-label" style={{ textTransform: "capitalize" }}>{roleName} Organizations *</label>
                            <Select 
                                isMulti
                                className="admin-form-select-multi" 
                                classNamePrefix="react-select"
                                options={selectOptions}
                                value={selectValue}
                                onChange={selected => setRoleOrganizations({ ...roleOrganizations, [roleSlug]: selected ? selected.map(s => s.value) : [] })}
                                placeholder="— Select Organizations —"
                                styles={{
                                    control: (provided) => ({ ...provided, borderColor: '#d1d5db', borderRadius: '8px', padding: '0px', fontSize: '14px', minHeight: '40px' }),
                                    option: (provided, state) => ({ ...provided, color: '#374151', backgroundColor: state.isFocused ? '#f3f4f6' : 'white' }),
                                    multiValueLabel: (provided) => ({ ...provided, color: '#374151' }),
                                    menuPortal: base => ({ ...base, zIndex: 9999 })
                                }}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            />
                        </div>
                    );
                })}

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
    const [selectedRoles, setSelectedRoles] = useState(
        target.roles?.length ? target.roles : [target.role]
    );
    const initialRoleOrgs = {};
    for (const [key, val] of Object.entries(target.roleOrganizations || {})) {
        initialRoleOrgs[key] = Array.isArray(val) ? val : (val ? [val] : []);
    }
    const [roleOrganizations, setRoleOrganizations] = useState(initialRoleOrgs);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ name: target.name || "", email: target.email || "", phone: target.phone || "", password: "", confirmPassword: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [formError, setFormError] = useState("");

    const availableRoles = isAdmin
        ? roles.filter(r => !["admin", "player", "viewer"].includes(r.slug))
        : roles.filter(r => !["admin", "organizer"].includes(r.slug));

    const toggleRole = (slug) => {
        setSelectedRoles(prev =>
            prev.includes(slug) ? prev.filter(r => r !== slug) : [...prev, slug]
        );
    };

    const handleSave = async () => {
        setFormError("");
        if (form.password && form.password !== form.confirmPassword) {
            setFormError("Passwords do not match");
            return;
        }
        if (!form.name || !form.email) {
            setFormError("Name and Email are required");
            return;
        }
        if (selectedRoles.length === 0) return;
        setSaving(true);
        const updates = {
            name: form.name,
            email: form.email,
            phone: form.phone,
            roles: selectedRoles,
            role: selectedRoles[0],
            roleOrganizations,
        };
        if (form.password) updates.password = form.password;
        await onSave(target._id, updates);
        setSaving(false);
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <h3 className="admin-modal-title">Edit User — {target.name}</h3>

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
                    <label className="admin-form-label">New Password <span style={{ fontWeight: 400, color: "#8b90a0" }}>(Leave blank to keep current)</span></label>
                    <div style={{ position: "relative" }}>
                        <input type={showPassword ? "text" : "password"} className="admin-form-input" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" style={{ paddingRight: 36 }} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8b90a0", fontSize: 14 }}>
                            <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                        </button>
                    </div>
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Confirm New Password</label>
                    <div style={{ position: "relative" }}>
                        <input type={showConfirm ? "text" : "password"} className="admin-form-input" autoComplete="new-password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Re-enter password" style={{ paddingRight: 36 }} />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8b90a0", fontSize: 14 }}>
                            <i className={`fa-solid ${showConfirm ? "fa-eye-slash" : "fa-eye"}`}></i>
                        </button>
                    </div>
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">Roles</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                        {availableRoles.map(r => (
                            <label key={r._id} style={{
                                display: "flex", alignItems: "center", gap: 6,
                                padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                                border: `1.5px solid ${selectedRoles.includes(r.slug) ? "#6366f1" : "#d1d5db"}`,
                                background: selectedRoles.includes(r.slug) ? "rgba(99,102,241,0.1)" : "#f9fafb",
                                color: selectedRoles.includes(r.slug) ? "#6366f1" : "#374151",
                                fontSize: 13, fontWeight: 500, userSelect: "none", transition: "all 0.15s",
                            }}>
                                <input
                                    type="checkbox"
                                    checked={selectedRoles.includes(r.slug)}
                                    onChange={() => toggleRole(r.slug)}
                                    style={{ display: "none" }}
                                />
                                {selectedRoles.includes(r.slug) && <i className="fa-solid fa-check" style={{ fontSize: 11 }}></i>}
                                {r.name || r.slug.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                            </label>
                        ))}
                    </div>
                </div>

                {isAdmin && selectedRoles.filter(r => !["admin", "viewer", "player"].includes(r)).map(roleSlug => {
                    const roleName = roles.find(r => r.slug === roleSlug)?.name || roleSlug.replace(/_/g, " ");
                    const currentSelected = roleOrganizations[roleSlug] || [];
                    const selectOptions = (organizations || []).map(o => ({ value: o._id, label: o.name }));
                    const selectValue = selectOptions.filter(o => currentSelected.includes(o.value));

                    return (
                        <div className="admin-form-group" key={roleSlug}>
                            <label className="admin-form-label" style={{ textTransform: "capitalize" }}>{roleName} Organizations *</label>
                            <Select 
                                isMulti
                                className="admin-form-select-multi" 
                                classNamePrefix="react-select"
                                options={selectOptions}
                                value={selectValue}
                                onChange={selected => setRoleOrganizations({ ...roleOrganizations, [roleSlug]: selected ? selected.map(s => s.value) : [] })}
                                placeholder="— Select Organizations —"
                                styles={{
                                    control: (provided) => ({ ...provided, borderColor: '#d1d5db', borderRadius: '8px', padding: '0px', fontSize: '14px', minHeight: '40px' }),
                                    option: (provided, state) => ({ ...provided, color: '#374151', backgroundColor: state.isFocused ? '#f3f4f6' : 'white' }),
                                    multiValueLabel: (provided) => ({ ...provided, color: '#374151' }),
                                    menuPortal: base => ({ ...base, zIndex: 9999 })
                                }}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            />
                        </div>
                    );
                })}

                <div style={{ marginTop: 12, fontSize: 12, color: "#8b90a0" }}>
                    Permissions are managed in the <strong>Roles</strong> page.
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving || selectedRoles.length === 0 || !form.name || !form.email}>
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminUsersPage() {
    const { user, activeRole } = useAuth();
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
                                                    {(() => {
                                                        const userOrgs = new Set();
                                                        if (u.organization) {
                                                            userOrgs.add(String(u.organization._id || u.organization));
                                                        }
                                                        if (u.roleOrganizations) {
                                                            Object.values(u.roleOrganizations).flat().forEach(orgId => {
                                                                if (orgId) userOrgs.add(String(orgId));
                                                            });
                                                        }
                                                        if (userOrgs.size === 0) return <span style={{ color: "#a0a4b2" }}>—</span>;
                                                        
                                                        const firstOrgId = Array.from(userOrgs)[0];
                                                        let firstOrgName = firstOrgId;
                                                        if (u.organization && String(u.organization._id || u.organization) === firstOrgId) {
                                                            firstOrgName = u.organization.name || firstOrgId;
                                                        } else {
                                                            const found = organizations.find(o => String(o._id) === firstOrgId);
                                                            if (found) firstOrgName = found.name;
                                                        }

                                                        return (
                                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                                <span>{firstOrgName}</span>
                                                                {userOrgs.size > 1 && (
                                                                    <span style={{ padding: "2px 6px", fontSize: 11, background: "#f3f4f6", color: "#6b7280", borderRadius: 10, fontWeight: 500 }}>
                                                                        +{userOrgs.size - 1}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td>
                                                    {(u.roles?.length ? u.roles : [u.role]).map(r => (
                                                        <span key={r} className={`admin-badge ${r}`} style={{ marginRight: 4 }}>{r}</span>
                                                    ))}
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
                            isAdmin={(activeRole || user?.role) === "admin"}
                        />
                    )}

                    {showAddUser && (
                        <AddUserModal
                            organizations={organizations}
                            roles={roles}
                            onClose={() => setShowAddUser(false)}
                            isAdmin={(activeRole || user?.role) === "admin"}
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
