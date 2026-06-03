"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";
import { useToast } from "@/components/AdminToast";

function PlayerModal({ onClose, onSave, initial, orgUsers, allTeams }) {
    const initialTeams = initial ? allTeams.filter(t => (t.players || []).some(tp => String(tp.player?._id || tp.player) === String(initial._id))).map(t => {
        const tp = (t.players || []).find(tp => String(tp.player?._id || tp.player) === String(initial._id));
        return { teamId: String(t._id), teamName: t.name, jerseyNumber: tp.jerseyNumber };
    }) : [];

    const [form, setForm] = useState({
        name: initial?.name || "",
        user: initial?.user || "",
        location: initial?.location || "",
        teams: initialTeams,
        about: initial?.about || "",
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        const payload = {
            name: form.name,
            location: form.location,
            teams: form.teams,
            about: form.about,
        };
        if (form.user) payload.user = form.user;
        await onSave(payload);
        setSaving(false);
    };

    return (
        <div className="admin-modal-backdrop">
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <button className="admin-modal-close" onClick={onClose} aria-label="Close">
                    <i className="fa-solid fa-xmark"></i>
                </button>
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
                    <label className="admin-form-label">Manage Teams</label>
                    <div style={{ background: "#f9fafb", border: "1px solid #e8eaef", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                        {form.teams.length === 0 ? (
                            <div style={{ fontSize: 13, color: "#8b90a0", fontStyle: "italic", padding: "8px 0" }}>Not assigned to any teams.</div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {form.teams.map((t, index) => (
                                    <div key={t.teamId} style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid #e5e7ef", borderRadius: 6, padding: "8px 12px", gap: 12 }}>
                                        <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{t.teamName}</div>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <label style={{ fontSize: 12, color: "#5a5f72", fontWeight: 500 }}>Jersey #</label>
                                            <input
                                                type="number"
                                                className="admin-form-input"
                                                value={t.jerseyNumber}
                                                onChange={(e) => {
                                                    const newTeams = [...form.teams];
                                                    newTeams[index].jerseyNumber = e.target.value;
                                                    setForm(prev => ({ ...prev, teams: newTeams }));
                                                }}
                                                placeholder="0-99"
                                                min="0"
                                                max="99"
                                                style={{ width: 64, textAlign: "center", padding: "6px" }}
                                            />
                                            <button
                                                type="button"
                                                className="admin-btn admin-btn-ghost admin-btn-sm"
                                                onClick={() => {
                                                    setForm(prev => ({ ...prev, teams: prev.teams.filter((_, i) => i !== index) }));
                                                }}
                                                style={{ color: "#dc2626", marginLeft: 4 }}
                                                title="Remove team"
                                            >
                                                <i className="fa-solid fa-xmark"></i>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <label className="admin-form-label">Add to another team</label>
                    <select 
                        className="admin-form-select" 
                        value=""
                        onChange={e => {
                            const selectedTeamId = e.target.value;
                            if (!selectedTeamId) return;
                            const team = allTeams.find(t => String(t._id) === selectedTeamId);
                            if (team && !form.teams.find(t => t.teamId === selectedTeamId)) {
                                setForm(prev => ({
                                    ...prev,
                                    teams: [...prev.teams, { teamId: selectedTeamId, teamName: team.name, jerseyNumber: "" }]
                                }));
                            }
                        }} 
                    >
                        <option value="">-- Select a team to add --</option>
                        {allTeams.filter(t => !form.teams.find(et => et.teamId === String(t._id))).map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
                    </select>
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

    const [allTeams, setAllTeams] = useState([]);

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
            
            const tRes = await fetch("/api/teams");
            const tData = await tRes.json();
            if (tData.success) setAllTeams(tData.data);
        } catch { showError("Failed to load players"); }
        finally { setLoading(false); }
    }, [slug, showError]);

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

    const playerTeamsMap = useMemo(() => {
        const map = {};
        players.forEach(p => map[p._id] = []);
        allTeams.forEach(t => {
            if (t.isPlaceholder) return;
            (t.players || []).forEach(tp => {
                const pid = String(tp.player?._id || tp.player);
                if (map[pid]) {
                    if (!map[pid].includes(t.name)) map[pid].push(t.name);
                }
            });
        });
        return map;
    }, [players, allTeams]);

    const filtered = players.filter(p => {
        const pTeams = playerTeamsMap[p._id] || [];
        return p.name.toLowerCase().includes(search.toLowerCase()) ||
               pTeams.some(tn => tn.toLowerCase().includes(search.toLowerCase())) ||
               (p.presentTeam?.name || "").toLowerCase().includes(search.toLowerCase());
    });

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
                                    {filtered.map(p => {
                                        const playerTeams = allTeams.filter(t => (t.players || []).some(tp => String(tp.player?._id || tp.player) === String(p._id))).map(t => {
                                            const tp = (t.players || []).find(tp => String(tp.player?._id || tp.player) === String(p._id));
                                            return { teamId: String(t._id), teamName: t.name, jerseyNumber: tp.jerseyNumber };
                                        });
                                        const firstTeam = playerTeams[0];
                                        const additionalTeamsCount = playerTeams.length > 1 ? playerTeams.length - 1 : 0;

                                        return (
                                        <tr key={p._id}>
                                            <td style={{ fontWeight: 600 }}>
                                                {p.name}
                                                {firstTeam && firstTeam.jerseyNumber != null && (
                                                    <span className="admin-badge player" style={{ marginLeft: 8, verticalAlign: "middle", fontSize: 11 }}>
                                                        #{firstTeam.jerseyNumber}
                                                    </span>
                                                )}
                                                {additionalTeamsCount > 0 && (
                                                    <span style={{ marginLeft: 6, verticalAlign: "middle", fontSize: 10, background: "#e8eaef", color: "#5a5f72", padding: "2px 6px", borderRadius: 10, fontWeight: 600, border: "1px solid #d5d8e0" }}>
                                                        +{additionalTeamsCount}
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                {firstTeam ? (
                                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                        <span>{firstTeam.teamName}</span>
                                                        {additionalTeamsCount > 0 && (
                                                            <span style={{ fontSize: 10, background: "#e8eaef", color: "#5a5f72", padding: "2px 6px", borderRadius: 10, fontWeight: 600, border: "1px solid #d5d8e0" }}>
                                                                +{additionalTeamsCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    "—"
                                                )}
                                            </td>
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
                                    )})}
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
                    allTeams={allTeams}
                    onClose={() => { setShowModal(false); setEditTarget(null); }}
                    onSave={handleSave}
                />
            )}
        </AdminLayout>
    );
}
