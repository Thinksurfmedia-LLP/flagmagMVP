"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

const PERM_LABELS = {
    manage_organizations: "Organizations (Full)",
    organization_view: "Organization View",
    organization_create: "Organization Create",
    organization_update: "Organization Update",
    organization_delete: "Organization Delete",
    manage_seasons: "Seasons (Full)",
    season_view: "Season View",
    season_create: "Season Create",
    season_update: "Season Update",
    season_delete: "Season Delete",
    manage_games: "Games (Full)",
    game_view: "Game View",
    game_create: "Game Create",
    game_update: "Game Update",
    game_delete: "Game Delete",
    manage_players: "Players (Full)",
    player_view: "Player View",
    player_create: "Player Create",
    player_update: "Player Update",
    player_delete: "Player Delete",
    manage_users: "Users (Full)",
    user_view: "User View",
    user_create: "User Create",
    user_update: "User Update",
    user_delete: "User Delete",
};

const MATRIX_COLUMNS = [
    { key: "view", label: "View" },
    { key: "create", label: "Create" },
    { key: "update", label: "Update" },
    { key: "delete", label: "Delete" },
    { key: "full", label: "Full Access" },
];

const PERMISSION_ROWS = [
    {
        module: "Organizations",
        permissions: {
            view: "organization_view",
            create: "organization_create",
            update: "organization_update",
            delete: "organization_delete",
            full: "manage_organizations",
        },
    },
    {
        module: "Seasons",
        permissions: {
            view: "season_view",
            create: "season_create",
            update: "season_update",
            delete: "season_delete",
            full: "manage_seasons",
        },
    },
    {
        module: "Games",
        permissions: {
            view: "game_view",
            create: "game_create",
            update: "game_update",
            delete: "game_delete",
            full: "manage_games",
        },
    },
    {
        module: "Players",
        permissions: {
            view: "player_view",
            create: "player_create",
            update: "player_update",
            delete: "player_delete",
            full: "manage_players",
        },
    },
    {
        module: "Users",
        permissions: {
            view: "user_view",
            create: "user_create",
            update: "user_update",
            delete: "user_delete",
            full: "manage_users",
        },
    },
];

const PERMISSION_GROUP_BY_KEY = PERMISSION_ROWS.reduce((acc, row) => {
    Object.entries(row.permissions).forEach(([action, permission]) => {
        acc[permission] = {
            action,
            permissions: row.permissions,
        };
    });
    return acc;
}, {});

function normalizePermissions(rawPermissions = []) {
    const selected = new Set(rawPermissions);

    PERMISSION_ROWS.forEach((row) => {
        const fullPermission = row.permissions.full;
        if (!fullPermission || !selected.has(fullPermission)) return;

        Object.values(row.permissions).forEach((permission) => selected.add(permission));
    });

    return Array.from(selected);
}

function getDisplayPermissions(rawPermissions = []) {
    const selected = new Set(rawPermissions.filter((permission) => permission !== "view_dashboard"));

    PERMISSION_ROWS.forEach((row) => {
        const fullPermission = row.permissions.full;
        if (!fullPermission || !selected.has(fullPermission)) return;

        Object.values(row.permissions)
            .filter((permission) => permission !== fullPermission)
            .forEach((permission) => selected.delete(permission));
    });

    const order = PERMISSION_ROWS.flatMap((row) => {
        const values = Object.values(row.permissions);
        const full = row.permissions.full;
        return full ? [full, ...values.filter((p) => p !== full)] : values;
    });

    const ordered = order.filter((permission, index) => selected.has(permission) && order.indexOf(permission) === index);
    const extras = Array.from(selected).filter((permission) => !order.includes(permission));
    return [...ordered, ...extras];
}

function togglePermissionSet(previousPermissions, targetPermission) {
    const selected = new Set(previousPermissions);
    const groupMeta = PERMISSION_GROUP_BY_KEY[targetPermission];

    if (!groupMeta) {
        if (selected.has(targetPermission)) selected.delete(targetPermission);
        else selected.add(targetPermission);
        return [...selected];
    }

    const entries = Object.entries(groupMeta.permissions);
    const allPermsInGroup = entries.map(([, permission]) => permission);
    const fullPermission = groupMeta.permissions.full;
    const crudPermissions = entries
        .filter(([action]) => action !== "full")
        .map(([, permission]) => permission);

    const isSelected = selected.has(targetPermission);

    if (groupMeta.action === "full") {
        if (isSelected) {
            allPermsInGroup.forEach((permission) => selected.delete(permission));
        } else {
            allPermsInGroup.forEach((permission) => selected.add(permission));
        }
        return [...selected];
    }

    if (isSelected) {
        selected.delete(targetPermission);
        if (fullPermission) selected.delete(fullPermission);
    } else {
        selected.add(targetPermission);
        if (fullPermission && crudPermissions.length > 0 && crudPermissions.every((permission) => selected.has(permission))) {
            selected.add(fullPermission);
        }
    }

    return [...selected];
}

function PermissionMatrix({ selectedPermissions, onToggle }) {
    return (
        <div style={{ overflowX: "auto", border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff" }}>
            <table className="admin-table" style={{ marginBottom: 0 }}>
                <thead style={{ background: "linear-gradient(180deg, #fbfcff 0%, #f7f9fc 100%)" }}>
                    <tr>
                        <th style={{ minWidth: 160 }}>Module</th>
                        {MATRIX_COLUMNS.map((column) => (
                            <th key={column.key} style={{ minWidth: 110, textAlign: "center" }}>{column.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {PERMISSION_ROWS.map((row) => (
                        <tr key={row.module}>
                            <td style={{ fontWeight: 600 }}>{row.module}</td>
                            {MATRIX_COLUMNS.map((column) => {
                                const perm = row.permissions[column.key];
                                if (!perm) {
                                    return (
                                        <td key={`${row.module}-${column.key}`} style={{ color: "#c0c4cf", fontSize: 13, textAlign: "center" }}>-</td>
                                    );
                                }

                                return (
                                    <td key={`${row.module}-${column.key}`} style={{ textAlign: "center" }}>
                                        <label className="admin-perm-item" style={{ justifyContent: "center", display: "inline-flex", padding: "6px 8px", margin: 0, border: "1px solid #e5e7eb", borderRadius: 8, background: "#f8fafc" }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedPermissions.includes(perm)}
                                                onChange={() => onToggle(perm)}
                                                aria-label={`${row.module} ${column.label}`}
                                            />
                                        </label>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

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
        setEditPerms(normalizePermissions(role.permissions));
    };

    const cancelEdit = () => {
        setEditId(null);
        setEditPerms([]);
    };

    const toggleEditPerm = (perm) => {
        setEditPerms((prev) => togglePermissionSet(prev, perm));
    };

    const toggleNewPerm = (perm) => {
        setNewPerms((prev) => togglePermissionSet(prev, perm));
    };

    const saveEdit = async () => {
        try {
            const res = await fetch(`/api/admin/roles/${editId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ permissions: normalizePermissions(editPerms) }),
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
                body: JSON.stringify({ name: newName.trim(), permissions: normalizePermissions(newPerms) }),
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
                                    <PermissionMatrix selectedPermissions={normalizePermissions(newPerms)} onToggle={toggleNewPerm} />
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
                                                {(() => {
                                                    const visiblePerms = getDisplayPermissions(r.permissions);
                                                    return editId === r._id ? (
                                                        <div>
                                                            <PermissionMatrix selectedPermissions={normalizePermissions(editPerms)} onToggle={toggleEditPerm} />
                                                            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                                                <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={saveEdit}>Save</button>
                                                                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={cancelEdit}>Cancel</button>
                                                            </div>
                                                        </div>
                                                    ) : visiblePerms.length > 0 ? (
                                                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                                            {visiblePerms.map(p => (
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
                                                    );
                                                })()}
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
