"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";
import { useToast } from "@/components/AdminToast";

function PlayerModal({ onClose, onSave, initial, orgUsers }) {
    const [form, setForm] = useState({
        name: initial?.name || "",
        user: initial?.user || "",
        location: initial?.location || "",
        presentTeamName: initial?.presentTeam?.name || "",
        about: initial?.about || "",
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        const payload = {
            name: form.name,
            location: form.location,
            presentTeam: { name: form.presentTeamName },
            about: form.about,
        };
        if (form.user) payload.user = form.user;
        await onSave(payload);
        setSaving(false);
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <h3 className="admin-modal-title">{initial ? "Edit Player" : "Add Player"}</h3>
                <div className="admin-form-group">
                    <label className="admin-form-label">Name *</label>
                    <input className="admin-form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Player full name" />
                </div>
                {!initial && orgUsers.length > 0 && (
                    <div className="admin-form-group">
                        <label className="admin-form-label">Link to User (optional)</label>
                        <select className="admin-form-select" value={form.user} onChange={e => setForm({ ...form, user: e.target.value })}>
                            <option value="">— No linked user —</option>
                            {orgUsers.map(u => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
                        </select>
                    </div>
                )}
                <div className="admin-form-group">
                    <label className="admin-form-label">Current Team</label>
                    <input className="admin-form-input" value={form.presentTeamName} onChange={e => setForm({ ...form, presentTeamName: e.target.value })} placeholder="e.g. Eagles" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Location</label>
                    <input className="admin-form-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="City, State" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">About</label>
                    <textarea className="admin-form-input" rows={3} value={form.about} onChange={e => setForm({ ...form, about: e.target.value })} placeholder="Short bio..." />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : initial ? "Save Changes" : "Create Player"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function OrgPlayersPage() {
    const { slug } = useParams();
    const { user } = useAuth();
    const { org: impersonatedOrg, enterImpersonation } = useImpersonation();
    const { showSuccess, showError } = useToast();

    const [players, setPlayers] = useState([]);
    const [orgUsers, setOrgUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);

    useEffect(() => {
        if (!impersonatedOrg && slug) {
            fetch(`/api/organizations/${slug}`)
                .then(r => r.json())
                .then(d => { if (d.success) enterImpersonation(d.data); })
                .catch(() => {});
        }
    }, [slug, impersonatedOrg, enterImpersonation]);

    const fetchPlayers = useCallback(async () => {
        try {
            const res = await fetch(`/api/organizations/${slug}/players`);
            const data = await res.json();
            if (data.success) setPlayers(data.data);
        } catch { showError("Failed to load players"); }
        finally { setLoading(false); }
    }, [slug]);

    useEffect(() => { fetchPlayers(); }, [fetchPlayers]);

    // Also fetch org users for linking
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/organizations/${slug}/users`);
                const data = await res.json();
                if (data.success) setOrgUsers(data.data.filter(u => u.role === "player"));
            } catch { /* ignored — user list is optional */ }
        })();
    }, [slug]);

    const handleSave = async (payload) => {
        try {
            if (editTarget) {
                const res = await fetch(`/api/players/${editTarget._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error); return; }
                showSuccess("Player updated!");
            } else {
                const res = await fetch(`/api/organizations/${slug}/players`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error); return; }
                showSuccess("Player created!");
            }
            setShowModal(false);
            setEditTarget(null);
            fetchPlayers();
        } catch { showError("Failed to save player"); }
    };

    const deletePlayer = async (player) => {
        if (!confirm(`Delete player "${player.name}"?`)) return;
        try {
            const res = await fetch(`/api/players/${player._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            fetchPlayers();
            showSuccess("Player deleted!");
        } catch { showError("Failed to delete player"); }
    };

    const filtered = players.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.presentTeam?.name || "").toLowerCase().includes(search.toLowerCase())
    );

    const canManage = user && hasAccess(user, "manage_players");
    const orgName = impersonatedOrg?.name || slug;

    return (
        <AdminLayout title="Players">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage players.</p>
                </div>
            ) : (
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3>{orgName} — Players ({filtered.length})</h3>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <input type="text" className="admin-form-input" placeholder="Search players..." value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 220 }} />
                            <button className="admin-btn admin-btn-primary" onClick={() => { setEditTarget(null); setShowModal(true); }}>
                                <i className="fa-solid fa-plus"></i> Add Player
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="admin-loading"><div className="admin-spinner"></div>Loading players...</div>
                    ) : filtered.length === 0 ? (
                        <div className="admin-empty">
                            <i className="fa-solid fa-users"></i>
                            <p>No players found. Add one to get started.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Team</th>
                                        <th>Rating</th>
                                        <th>Location</th>
                                        <th>Joined</th>
                                        <th style={{ width: 120 }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(p => (
                                        <tr key={p._id}>
                                            <td style={{ fontWeight: 600 }}>{p.name}</td>
                                            <td>{p.presentTeam?.name || "—"}</td>
                                            <td>⭐ {p.overallRating || p.rating || 0}</td>
                                            <td style={{ color: "#5a5f72" }}>{p.location || "—"}</td>
                                            <td style={{ color: "#8b90a0", fontSize: 13 }}>{p.joinYear || "—"}</td>
                                            <td>
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => { setEditTarget(p); setShowModal(true); }} title="Edit">
                                                        <i className="fa-solid fa-pen"></i>
                                                    </button>
                                                    <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deletePlayer(p)} title="Delete">
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
            )}
            {showModal && (
                <PlayerModal
                    initial={editTarget}
                    orgUsers={orgUsers}
                    onClose={() => { setShowModal(false); setEditTarget(null); }}
                    onSave={handleSave}
                />
            )}
        </AdminLayout>
    );
}
