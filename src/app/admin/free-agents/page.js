"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout, { hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

function AddFreeAgentModal({ onClose, onSave, organizations, isAdmin }) {
    const [mode, setMode] = useState("existing"); // "existing" | "new"
    const [organization, setOrganization] = useState("");
    const [userSearch, setUserSearch] = useState("");
    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState("");
    const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    // Fetch users for "existing" mode
    useEffect(() => {
        let cancelled = false;
        setLoadingUsers(true);
        fetch("/api/admin/users")
            .then((r) => r.json())
            .then((data) => {
                if (!cancelled && data.success) setUsers(data.data || []);
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoadingUsers(false); });
        return () => { cancelled = true; };
    }, []);

    const filteredUsers = useMemo(() => {
        if (!userSearch.trim()) return users;
        const q = userSearch.toLowerCase();
        return users.filter((u) =>
            u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
        );
    }, [users, userSearch]);

    const handleSave = async () => {
        setFormError("");
        if (isAdmin && !organization) {
            setFormError("Please select an organization");
            return;
        }

        if (mode === "existing") {
            if (!selectedUserId) { setFormError("Please select a user"); return; }
            setSaving(true);
            await onSave({ userId: selectedUserId, organization: isAdmin ? organization : undefined });
            setSaving(false);
        } else {
            if (!form.name || !form.email || !form.password) {
                setFormError("Name, email, and password are required");
                return;
            }
            if (form.password.length < 6) {
                setFormError("Password must be at least 6 characters");
                return;
            }
            if (form.password !== form.confirmPassword) {
                setFormError("Passwords do not match");
                return;
            }
            setSaving(true);
            await onSave({
                name: form.name,
                email: form.email,
                phone: form.phone,
                password: form.password,
                organization: isAdmin ? organization : undefined,
            });
            setSaving(false);
        }
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
                <h3 className="admin-modal-title">Add Free Agent</h3>

                {formError && (
                    <div className="admin-alert admin-alert-error" style={{ marginBottom: 12 }}>
                        <i className="fa-solid fa-exclamation-circle"></i> {formError}
                    </div>
                )}

                {/* Organization (admin only) */}
                {isAdmin && (
                    <div className="admin-form-group">
                        <label className="admin-form-label">Organization *</label>
                        <select
                            className="admin-form-select"
                            value={organization}
                            onChange={(e) => setOrganization(e.target.value)}
                        >
                            <option value="">Select organization...</option>
                            {(organizations || []).map((o) => (
                                <option key={o._id} value={o._id}>{o.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Mode toggle */}
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <button
                        className={`admin-btn ${mode === "existing" ? "admin-btn-primary" : "admin-btn-ghost"} admin-btn-sm`}
                        onClick={() => setMode("existing")}
                    >
                        Select Existing User
                    </button>
                    <button
                        className={`admin-btn ${mode === "new" ? "admin-btn-primary" : "admin-btn-ghost"} admin-btn-sm`}
                        onClick={() => setMode("new")}
                    >
                        Create New User
                    </button>
                </div>

                {mode === "existing" ? (
                    <div className="admin-form-group">
                        <label className="admin-form-label">Select User</label>
                        <input
                            className="admin-form-input"
                            placeholder="Search by name or email..."
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            style={{ marginBottom: 8 }}
                        />
                        <div className="admin-location-list" style={{ maxHeight: 240 }}>
                            {loadingUsers ? (
                                <div style={{ color: "#8b90a0", fontSize: 13, padding: 12 }}>Loading users...</div>
                            ) : filteredUsers.length === 0 ? (
                                <div style={{ color: "#8b90a0", fontSize: 13, padding: 12 }}>No matching users found.</div>
                            ) : (
                                filteredUsers.map((u) => {
                                    const checked = selectedUserId === String(u._id);
                                    return (
                                        <label
                                            key={u._id}
                                            className={`admin-location-option ${checked ? "selected" : ""}`}
                                        >
                                            <input
                                                type="radio"
                                                name="selectUser"
                                                checked={checked}
                                                onChange={() => setSelectedUserId(String(u._id))}
                                            />
                                            <span>
                                                <strong>{u.name}</strong>
                                                <small>{u.email} &middot; {u.role}</small>
                                            </span>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="admin-form-group">
                            <label className="admin-form-label">Name *</label>
                            <input
                                className="admin-form-input"
                                autoComplete="off"
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="Full name"
                            />
                        </div>
                        <div className="admin-form-group">
                            <label className="admin-form-label">Email *</label>
                            <input
                                type="email"
                                className="admin-form-input"
                                autoComplete="off"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                placeholder="user@example.com"
                            />
                        </div>
                        <div className="admin-form-group">
                            <label className="admin-form-label">Phone</label>
                            <input
                                className="admin-form-input"
                                autoComplete="off"
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                placeholder="+1-555-0000"
                            />
                        </div>
                        <div className="admin-form-group">
                            <label className="admin-form-label">Password *</label>
                            <div style={{ position: "relative" }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className="admin-form-input"
                                    autoComplete="new-password"
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                    placeholder="Min 6 characters"
                                    style={{ paddingRight: 36 }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                                        background: "none", border: "none", cursor: "pointer", color: "#8b90a0", fontSize: 14,
                                    }}
                                >
                                    <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                                </button>
                            </div>
                        </div>
                        <div className="admin-form-group">
                            <label className="admin-form-label">Confirm Password *</label>
                            <input
                                type={showPassword ? "text" : "password"}
                                className="admin-form-input"
                                autoComplete="new-password"
                                value={form.confirmPassword}
                                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                                placeholder="Re-enter password"
                            />
                        </div>
                    </>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Cancel</button>
                    <button
                        className="admin-btn admin-btn-primary"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Add Free Agent"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminFreeAgentsPage() {
    const { user, activeRole } = useAuth();
    const effectiveRole = activeRole || user?.role;
    const isAdmin = effectiveRole === "admin";
    const { showSuccess, showError } = useToast();

    const [freeAgents, setFreeAgents] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [assigning, setAssigning] = useState(null); // player ID currently being assigned

    const canManage = user && hasAnyAccess(user, [
        "manage_players",
        "player_view",
        "player_create",
        "player_update",
        "player_delete",
    ]);
    const canCreate = isAdmin && user && hasAnyAccess(user, ["manage_players", "player_create"]);
    const canDelete = isAdmin && user && hasAnyAccess(user, ["manage_players", "player_delete"]);

    const fetchData = useCallback(async () => {
        if (!canManage) { setLoading(false); return; }
        try {
            const fetches = [fetch("/api/free-agents"), fetch("/api/teams")];
            if (isAdmin) fetches.push(fetch("/api/organizations"));

            const responses = await Promise.all(fetches);
            const [faData, teamsData, orgData] = await Promise.all(responses.map(r => r.json()));

            if (faData.success) setFreeAgents(faData.data || []);
            else showError(faData.error || "Failed to load free agents");

            if (teamsData.success) setTeams(teamsData.data || []);

            if (orgData?.success) setOrganizations(orgData.data || []);
        } catch {
            showError("Failed to load free agents");
        } finally {
            setLoading(false);
        }
    }, [canManage, isAdmin, showError]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = freeAgents.filter((fa) => {
        const q = search.toLowerCase();
        return (
            fa.name?.toLowerCase().includes(q) ||
            fa.user?.email?.toLowerCase().includes(q) ||
            fa.organization?.name?.toLowerCase().includes(q)
        );
    });

    const saveFreeAgent = async (payload) => {
        try {
            const res = await fetch("/api/free-agents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!data.success) {
                showError(data.error || "Failed to add free agent");
                return;
            }
            setModalOpen(false);
            fetchData();
            showSuccess("Free agent added!");
        } catch {
            showError("Failed to add free agent");
        }
    };

    const deleteFreeAgent = async (fa) => {
        if (!confirm(`Remove "${fa.name}" as a free agent?`)) return;
        try {
            const res = await fetch(`/api/free-agents/${fa._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) {
                showError(data.error || "Failed to remove free agent");
                return;
            }
            fetchData();
            showSuccess("Free agent removed!");
        } catch {
            showError("Failed to remove free agent");
        }
    };

    const assignToTeam = async (fa, teamId) => {
        if (!teamId) return;
        const team = teams.find(t => String(t._id) === teamId);
        if (!team) return;

        setAssigning(fa._id);
        try {
            const currentPlayerIds = (team.players || []).map(p => String(p._id || p));
            const updatedPlayerIds = [...currentPlayerIds, String(fa._id)];

            const res = await fetch(`/api/teams/${teamId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ players: updatedPlayerIds }),
            });
            const data = await res.json();
            if (!data.success) {
                showError(data.error || "Failed to assign to team");
                return;
            }
            fetchData();
            showSuccess(`${fa.name} assigned to ${team.name}!`);
        } catch {
            showError("Failed to assign to team");
        } finally {
            setAssigning(null);
        }
    };

    return (
        <AdminLayout title="Free Agents">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage free agents.</p>
                </div>
            ) : (
                <>
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3>Free Agents ({filtered.length})</h3>
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    placeholder="Search..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    style={{ maxWidth: 220 }}
                                />
                                {canCreate && (
                                    <button
                                        className="admin-btn admin-btn-primary"
                                        onClick={() => setModalOpen(true)}
                                    >
                                        <i className="fa-solid fa-plus"></i> Add Free Agent
                                    </button>
                                )}
                            </div>
                        </div>

                        {loading ? (
                            <div className="admin-loading">
                                <div className="admin-spinner"></div>
                                Loading free agents...
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-user-clock"></i>
                                <p>No free agents found.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            {isAdmin && <th>Organization</th>}
                                            <th>Phone</th>
                                            <th>{isAdmin ? "Added" : "Assign to Team"}</th>
                                            {isAdmin && <th style={{ width: 80 }}>Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((fa) => (
                                            <tr key={fa._id}>
                                                <td style={{ fontWeight: 600 }}>{fa.name}</td>
                                                <td style={{ color: "#6b7280" }}>{fa.user?.email || "—"}</td>
                                                {isAdmin && (
                                                    <td>{fa.organization?.name || "—"}</td>
                                                )}
                                                <td style={{ color: "#6b7280" }}>{fa.user?.phone || "—"}</td>
                                                <td>
                                                    {isAdmin ? (
                                                        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                                                            {fa.createdAt ? new Date(fa.createdAt).toLocaleDateString() : "—"}
                                                        </span>
                                                    ) : (
                                                        <select
                                                            className="admin-form-select"
                                                            style={{ minWidth: 160, padding: "4px 8px", fontSize: 13 }}
                                                            value=""
                                                            onChange={(e) => assignToTeam(fa, e.target.value)}
                                                            disabled={assigning === fa._id}
                                                        >
                                                            <option value="">{assigning === fa._id ? "Assigning..." : "Select team..."}</option>
                                                            {teams.map((t) => (
                                                                <option key={t._id} value={t._id}>{t.name}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </td>
                                                {isAdmin && (
                                                    <td>
                                                        {canDelete && (
                                                            <button
                                                                className="admin-btn admin-btn-danger admin-btn-sm"
                                                                onClick={() => deleteFreeAgent(fa)}
                                                                title="Remove free agent"
                                                            >
                                                                <i className="fa-solid fa-trash"></i>
                                                            </button>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {modalOpen && (
                        <AddFreeAgentModal
                            onClose={() => setModalOpen(false)}
                            onSave={saveFreeAgent}
                            organizations={organizations}
                            isAdmin={isAdmin}
                        />
                    )}
                </>
            )}
        </AdminLayout>
    );
}
