"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AdminPagination from "@/components/AdminPagination";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

export default function AdminPlayersPage() {
    const { user } = useAuth();
    const [players, setPlayers] = useState([]);
    const [allTeams, setAllTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [teamFilter, setTeamFilter] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;
    const { showSuccess, showError } = useToast();

    // Edit modal states
    const [editPlayer, setEditPlayer] = useState(null);
    const [editForm, setEditForm] = useState({ name: "", photo: "", teamName: "", jerseyNumber: "" });
    const [saving, setSaving] = useState(false);

    const fetchPlayers = useCallback(async () => {
        try {
            const res = await fetch("/api/players?status=player");
            const data = await res.json();
            if (data.success) setPlayers(data.data);
        } catch { showError("Failed to load players"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { 
        fetchPlayers(); 
        // Fetch all teams for the reassignment dropdown
        fetch("/api/teams")
            .then(res => res.json())
            .then(data => { if (data.success) setAllTeams(data.data); })
            .catch(() => {});
    }, [fetchPlayers]);

    const togglePlayerStatus = async (id, name, currentActiveState) => {
        const actionText = currentActiveState !== false ? "deactivate" : "reactivate";
        if (!confirm(`Are you sure you want to ${actionText} ${name}?`)) return;
        try {
            const res = await fetch(`/api/players/${id}`, { 
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: currentActiveState === false ? true : false })
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            fetchPlayers();
            showSuccess(`Player ${actionText}d successfully!`);
        } catch { showError(`Failed to ${actionText} player`); }
    };

    const deletePlayer = async (id) => {
        if (!confirm("Delete this player permanently?")) return;
        try {
            const res = await fetch(`/api/players/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            fetchPlayers();
            showSuccess("Player deleted!");
        } catch { showError("Failed to delete player"); }
    };

    const handleSaveEdit = async () => {
        if (!editPlayer) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/players/${editPlayer._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editForm),
            });
            const data = await res.json();
            if (data.success) {
                showSuccess("Player updated!");
                setEditPlayer(null);
                fetchPlayers();
            } else { showError(data.error || "Failed to update"); }
        } catch { showError("Failed to update player"); }
        finally { setSaving(false); }
    };

    const uniqueTeamsForFilter = Array.from(new Set(players.map(p => p.presentTeam?.name).filter(Boolean))).sort();

    const filtered = players.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.presentTeam?.name || "").toLowerCase().includes(search.toLowerCase());
        const matchesTeam = teamFilter === "all" || (p.presentTeam?.name === teamFilter);
        return matchesSearch && matchesTeam;
    });

    useEffect(() => { setCurrentPage(1); }, [search, teamFilter]);

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginatedPlayers = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const canManage = user && hasAccess(user, "manage_players");

    return (
        <AdminLayout title="Players">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage players.</p>
                </div>
            ) : (
                <>
                    <div className="admin-card">
                        <div className="admin-card-header" style={{ flexWrap: "wrap", gap: 12 }}>
                            <h3>Players ({filtered.length})</h3>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                <select 
                                    className="admin-form-select" 
                                    value={teamFilter} 
                                    onChange={e => setTeamFilter(e.target.value)}
                                    style={{ maxWidth: 180 }}
                                >
                                    <option value="all">All Teams</option>
                                    {uniqueTeamsForFilter.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    placeholder="Search players..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    style={{ maxWidth: 220 }}
                                />
                            </div>
                        </div>

                        {loading ? (
                            <div className="admin-loading">
                                <div className="admin-spinner"></div>
                                Loading players...
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-users"></i>
                                <p>No players found.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Team</th>
                                            <th>Rating</th>
                                            <th style={{ width: 140 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedPlayers.map(p => {
                                            const isInactive = p.isActive === false;
                                            return (
                                            <tr key={p._id} style={{ opacity: isInactive ? 0.4 : 1, transition: "opacity 0.2s" }}>
                                                <td style={{ fontWeight: 600 }}>
                                                    {p.photo && <img src={p.photo} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", marginRight: 12, verticalAlign: "middle" }} />}
                                                    <span style={{ verticalAlign: "middle" }}>{p.name}</span>
                                                    {p.jerseyNumber != null && (
                                                        <span className={`admin-badge ${isInactive ? "secondary" : "player"}`} style={{ marginLeft: 8, verticalAlign: "middle", fontSize: 11 }}>
                                                            #{p.jerseyNumber}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>{p.presentTeam?.name || "—"}</td>
                                                <td>⭐ {p.overallRating || p.rating || 0}</td>
                                                <td>
                                                    <div style={{ display: "flex", gap: 6, opacity: isInactive ? 0.8 : 1 }}>
                                                        <button 
                                                            className="admin-btn admin-btn-ghost admin-btn-sm" 
                                                            title="Edit Info"
                                                            onClick={() => {
                                                                setEditPlayer(p);
                                                                setEditForm({ 
                                                                    name: p.name, 
                                                                    photo: p.photo || "", 
                                                                    teamName: p.presentTeam?.name || "", 
                                                                    jerseyNumber: p.jerseyNumber != null ? p.jerseyNumber : "" 
                                                                });
                                                            }}
                                                        >
                                                            <i className="fa-solid fa-pen"></i>
                                                        </button>
                                                        <Link href={`/players/${p._id}`} className="admin-btn admin-btn-ghost admin-btn-sm" title="View Profile">
                                                            <i className="fa-solid fa-eye"></i>
                                                        </Link>
                                                        {isInactive ? (
                                                            <button className="admin-btn admin-btn-success admin-btn-sm" title="Reactivate Player" onClick={() => togglePlayerStatus(p._id, p.name, p.isActive)}>
                                                                <i className="fa-solid fa-check"></i>
                                                            </button>
                                                        ) : (
                                                            <button className="admin-btn admin-btn-danger admin-btn-sm" title="Deactivate Player" onClick={() => togglePlayerStatus(p._id, p.name, p.isActive)}>
                                                                <i className="fa-solid fa-power-off"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )})}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        
                        {filtered.length > 0 && Math.ceil(filtered.length / itemsPerPage) > 1 && (
                            <AdminPagination 
                                currentPage={currentPage} 
                                totalPages={totalPages} 
                                totalItems={filtered.length} 
                                itemsPerPage={itemsPerPage} 
                                onPageChange={setCurrentPage} 
                            />
                        )}
                    </div>

                    {editPlayer && (
                        <div className="admin-modal-backdrop" onClick={() => setEditPlayer(null)}>
                            <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
                                <h3 className="admin-modal-title">Edit Player Info</h3>
                                
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Profile Image</label>
                                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                                        {editForm.photo ? (
                                            <img src={editForm.photo} alt="Preview" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                            <div style={{ width: 60, height: 60, borderRadius: '50%', backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <i className="fa-solid fa-user" style={{ color: '#aaa', fontSize: 24 }}></i>
                                            </div>
                                        )}
                                        <input 
                                            type="file"
                                            accept="image/*"
                                            className="admin-form-input" 
                                            onChange={async (e) => {
                                                const file = e.target.files[0];
                                                if (!file) return;
                                                const fd = new FormData();
                                                fd.append("file", file);
                                                try {
                                                    const res = await fetch("/api/upload", { method: "POST", body: fd });
                                                    const data = await res.json();
                                                    if (data.url) setEditForm(prev => ({ ...prev, photo: data.url }));
                                                } catch { showError("Upload failed"); }
                                            }} 
                                        />
                                    </div>
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">Name *</label>
                                    <input 
                                        className="admin-form-input" 
                                        value={editForm.name} 
                                        onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))} 
                                        required 
                                    />
                                </div>
                                
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Team</label>
                                    <select 
                                        className="admin-form-select" 
                                        value={editForm.teamName} 
                                        onChange={e => setEditForm(prev => ({ ...prev, teamName: e.target.value }))} 
                                    >
                                        <option value="">-- No Team (Free Agent) --</option>
                                        {allTeams.map(t => <option key={t._id} value={t.name}>{t.name}</option>)}
                                    </select>
                                </div>

                                {editForm.teamName && (
                                    <div className="admin-form-group">
                                        <label className="admin-form-label">Jersey Number</label>
                                        <input 
                                            type="number"
                                            min="0"
                                            max="99"
                                            className="admin-form-input" 
                                            value={editForm.jerseyNumber} 
                                            onChange={e => setEditForm(prev => ({ ...prev, jerseyNumber: e.target.value }))} 
                                        />
                                    </div>
                                )}

                                <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
                                    <button className="admin-btn admin-btn-ghost" onClick={() => setEditPlayer(null)}>Cancel</button>
                                    <button className="admin-btn admin-btn-primary" onClick={handleSaveEdit} disabled={saving || !editForm.name}>
                                        {saving ? "Saving..." : "Save Changes"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </AdminLayout>
    );
}
