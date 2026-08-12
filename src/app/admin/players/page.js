"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
    const [teamRemovalPrompt, setTeamRemovalPrompt] = useState(null); // { team, index }

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

    const uniqueTeamsForFilter = Array.from(new Set(Object.values(playerTeamsMap).flat())).sort();

    const filtered = players.filter(p => {
        const pTeams = playerTeamsMap[p._id] || [];
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                              pTeams.some(tn => tn.toLowerCase().includes(search.toLowerCase())) ||
                              (p.presentTeam?.name || "").toLowerCase().includes(search.toLowerCase());
        const matchesTeam = teamFilter === "all" || pTeams.includes(teamFilter) || (p.presentTeam?.name === teamFilter);
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
                            <div className="players-header-filters" style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                            <>
                                {/* Desktop table */}
                                <div className="players-table-wrap">
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
                                                    const playerTeams = allTeams.filter(t => (t.players || []).some(tp => String(tp.player?._id || tp.player) === String(p._id))).map(t => {
                                                        const tp = (t.players || []).find(tp => String(tp.player?._id || tp.player) === String(p._id));
                                                        return { teamId: String(t._id), teamName: t.name, jerseyNumber: tp.jerseyNumber };
                                                    });
                                                    const firstTeam = playerTeams[0];
                                                    // When filtered to a specific team, show that team's jersey number
                                                    // instead of whichever team happens to be first in the list.
                                                    const displayTeam = (teamFilter !== "all" && playerTeams.find(t => t.teamName === teamFilter)) || firstTeam;
                                                    const additionalTeamsCount = playerTeams.length > 1 ? playerTeams.length - 1 : 0;

                                                    return (
                                                    <tr key={p._id} style={{ opacity: isInactive ? 0.4 : 1, transition: "opacity 0.2s" }}>
                                                        <td style={{ fontWeight: 600 }}>
                                                            <img src={p.photo || "/assets/images/player-placeholder.svg"} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", marginRight: 12, verticalAlign: "middle" }} />
                                                            <span style={{ verticalAlign: "middle" }}>{p.name}</span>
                                                            {displayTeam && displayTeam.jerseyNumber != null && (
                                                                <span className={`admin-badge ${isInactive ? "secondary" : "player"}`} style={{ marginLeft: 8, verticalAlign: "middle", fontSize: 11 }}>
                                                                    #{displayTeam.jerseyNumber}
                                                                </span>
                                                            )}
                                                            {additionalTeamsCount > 0 && (
                                                                <span style={{ marginLeft: 6, verticalAlign: "middle", fontSize: 10, background: "#e8eaef", color: "#5a5f72", padding: "2px 6px", borderRadius: 10, fontWeight: 600, border: "1px solid #d5d8e0" }}>
                                                                    +{additionalTeamsCount}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td>
                                                            {displayTeam ? (
                                                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                                    <span>{displayTeam.teamName}</span>
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
                                                                            teams: playerTeams,
                                                                            deleteStatsFor: []
                                                                        });
                                                                        setTeamRemovalPrompt(null);
                                                                    }}
                                                                >
                                                                    <i className="fa-solid fa-pen"></i>
                                                                </button>
                                                                {/* <Link href={`/players/${p._id}`} className="admin-btn admin-btn-ghost admin-btn-sm" title="View Profile">
                                                                    <i className="fa-solid fa-eye"></i>
                                                                </Link> */}
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
                                </div>

                                {/* Mobile cards */}
                                <div className="players-card-list">
                                    {paginatedPlayers.map(p => {
                                        const isInactive = p.isActive === false;
                                        const playerTeams = allTeams.filter(t => (t.players || []).some(tp => String(tp.player?._id || tp.player) === String(p._id))).map(t => {
                                            const tp = (t.players || []).find(tp => String(tp.player?._id || tp.player) === String(p._id));
                                            return { teamId: String(t._id), teamName: t.name, jerseyNumber: tp.jerseyNumber };
                                        });
                                        const firstTeam = playerTeams[0];
                                        // When filtered to a specific team, show that team's jersey number
                                        // instead of whichever team happens to be first in the list.
                                        const displayTeam = (teamFilter !== "all" && playerTeams.find(t => t.teamName === teamFilter)) || firstTeam;
                                        const additionalTeamsCount = playerTeams.length > 1 ? playerTeams.length - 1 : 0;

                                        return (
                                            <div key={p._id} className="players-card-item" style={{ opacity: isInactive ? 0.5 : 1 }}>
                                                <div className="players-card-item-header">
                                                    <img src={p.photo || "/assets/images/player-placeholder.svg"} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                                                    <div className="players-card-item-title">
                                                        {p.name}
                                                        {displayTeam && displayTeam.jerseyNumber != null && (
                                                            <span className={`admin-badge ${isInactive ? "secondary" : "player"}`} style={{ marginLeft: 8, fontSize: 11 }}>
                                                                #{displayTeam.jerseyNumber}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span style={{ fontSize: 13, color: "#8b90a0", flexShrink: 0 }}>⭐ {p.overallRating || p.rating || 0}</span>
                                                </div>
                                                <div className="players-card-item-meta">
                                                    {displayTeam ? (
                                                        <span>
                                                            {displayTeam.teamName}
                                                            {additionalTeamsCount > 0 && (
                                                                <span style={{ marginLeft: 6, fontSize: 11, background: "#e8eaef", color: "#5a5f72", padding: "2px 6px", borderRadius: 10, fontWeight: 600 }}>
                                                                    +{additionalTeamsCount} more
                                                                </span>
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontStyle: "italic" }}>No team assigned</span>
                                                    )}
                                                </div>
                                                <div className="players-card-item-actions">
                                                    <button
                                                        className="admin-btn admin-btn-ghost admin-btn-sm"
                                                        onClick={() => {
                                                            setEditPlayer(p);
                                                            setEditForm({
                                                                name: p.name,
                                                                photo: p.photo || "",
                                                                teams: playerTeams,
                                                                deleteStatsFor: []
                                                            });
                                                            setTeamRemovalPrompt(null);
                                                        }}
                                                    >
                                                        <i className="fa-solid fa-pen"></i> Edit
                                                    </button>
                                                    {isInactive ? (
                                                        <button className="admin-btn admin-btn-success admin-btn-sm" onClick={() => togglePlayerStatus(p._id, p.name, p.isActive)}>
                                                            <i className="fa-solid fa-check"></i> Reactivate
                                                        </button>
                                                    ) : (
                                                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => togglePlayerStatus(p._id, p.name, p.isActive)}>
                                                            <i className="fa-solid fa-power-off"></i> Deactivate
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
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
                        <div className="admin-modal-backdrop">
                            <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
                                {teamRemovalPrompt && (
                                    <div style={{ position: "absolute", inset: 0, background: "#fff", borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10, padding: 32 }}>
                                        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
                                            <i className="fa-solid fa-triangle-exclamation" style={{ color: "#dc2626", fontSize: 20 }}></i>
                                        </div>
                                        <p style={{ fontWeight: 700, fontSize: 17, marginBottom: 10, textAlign: "center", color: "#1a1d26" }}>
                                            Remove {teamRemovalPrompt.team.teamName}?
                                        </p>
                                        <p style={{ fontSize: 13, color: "#5a5f72", marginBottom: 28, textAlign: "center", lineHeight: 1.6, maxWidth: 320 }}>
                                            Do you also want to <strong style={{ color: "#dc2626" }}>delete all stats</strong> for this player from <strong style={{ color: "#1a1d26" }}>{teamRemovalPrompt.team.teamName}</strong>, or keep them as historical records?
                                        </p>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 300 }}>
                                            <button
                                                className="admin-btn admin-btn-danger"
                                                style={{ width: "100%", justifyContent: "center" }}
                                                onClick={() => {
                                                    setEditForm(prev => ({
                                                        ...prev,
                                                        teams: prev.teams.filter((_, i) => i !== teamRemovalPrompt.index),
                                                        deleteStatsFor: [...(prev.deleteStatsFor || []), teamRemovalPrompt.team.teamName]
                                                    }));
                                                    setTeamRemovalPrompt(null);
                                                }}
                                            >
                                                <i className="fa-solid fa-trash" style={{ marginRight: 8 }}></i>
                                                Remove &amp; Delete Stats
                                            </button>
                                            <button
                                                className="admin-btn admin-btn-primary"
                                                style={{ width: "100%", justifyContent: "center" }}
                                                onClick={() => {
                                                    setEditForm(prev => ({ ...prev, teams: prev.teams.filter((_, i) => i !== teamRemovalPrompt.index) }));
                                                    setTeamRemovalPrompt(null);
                                                }}
                                            >
                                                <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: 8 }}></i>
                                                Remove &amp; Keep Stats
                                            </button>
                                            <button className="admin-btn admin-btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => setTeamRemovalPrompt(null)}>
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <button className="admin-modal-close" onClick={() => setEditPlayer(null)} aria-label="Close">
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                                <h3 className="admin-modal-title">Edit Player Info</h3>

                                <div style={{ overflowY: "auto", flex: 1, paddingRight: 2 }}>
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
                                                    // A file over the server's upload limit never reaches our
                                                    // API route at all — nginx rejects it with a raw 413 HTML
                                                    // page, not JSON, so calling res.json() on it throws.
                                                    if (res.status === 413) { showError("Upload size limit exceeded. Maximum file size is 1MB."); return; }
                                                    const data = await res.json();
                                                    if (data.url) setEditForm(prev => ({ ...prev, photo: data.url }));
                                                    else showError(data.error || "Upload failed");
                                                } catch { showError("Upload failed"); }
                                            }}
                                        />
                                    </div>
                                    <div style={{ marginTop: 6, fontSize: 12, color: "#dc2626" }}>Max file size: 1MB</div>
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
                                    <label className="admin-form-label">Available Teams</label>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                                        {allTeams.filter(t => !t.isPlaceholder && !(editForm.teams || []).find(st => st.teamId === String(t._id))).map(t => (
                                            <div
                                                key={t._id}
                                                onClick={() => {
                                                    setEditForm(prev => ({
                                                        ...prev,
                                                        teams: [...(prev.teams || []), { teamId: String(t._id), teamName: t.name, jerseyNumber: "" }]
                                                    }));
                                                }}
                                                style={{
                                                    padding: "6px 12px",
                                                    background: "#f0f1f5",
                                                    border: "1px solid #d5d8e0",
                                                    borderRadius: 16,
                                                    fontSize: 13,
                                                    cursor: "pointer",
                                                    color: "#1a1d26",
                                                    transition: "all 0.2s"
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = "#e5e7ef"; e.currentTarget.style.borderColor = "#c5c8d0"; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = "#f0f1f5"; e.currentTarget.style.borderColor = "#d5d8e0"; }}
                                            >
                                                + {t.name}
                                            </div>
                                        ))}
                                        {allTeams.filter(t => !t.isPlaceholder && !(editForm.teams || []).find(st => st.teamId === String(t._id))).length === 0 && (
                                            <div style={{ fontSize: 13, color: "#8b90a0", fontStyle: "italic" }}>No more teams available.</div>
                                        )}
                                    </div>

                                    <label className="admin-form-label">Team Pool (Selected)</label>
                                    <div style={{ background: "#f9fafb", border: "1px solid #e8eaef", borderRadius: 8, padding: 12 }}>
                                        {editForm.teams?.length === 0 ? (
                                            <div style={{ fontSize: 13, color: "#8b90a0", fontStyle: "italic", padding: "8px 0" }}>Not assigned to any teams.</div>
                                        ) : (
                                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                                {(editForm.teams || []).map((t, index) => (
                                                    <div key={t.teamId} style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid #e5e7ef", borderRadius: 6, padding: "8px 12px", gap: 12 }}>
                                                        <div style={{ flex: 1, fontWeight: 600, fontSize: 14, color: "#1a1d26" }}>{t.teamName}</div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <label style={{ fontSize: 12, color: "#5a5f72", fontWeight: 500 }}>Jersey #</label>
                                                            <input
                                                                type="number"
                                                                className="admin-form-input"
                                                                value={t.jerseyNumber}
                                                                onChange={(e) => {
                                                                    const newTeams = [...editForm.teams];
                                                                    newTeams[index].jerseyNumber = e.target.value;
                                                                    setEditForm(prev => ({ ...prev, teams: newTeams }));
                                                                }}
                                                                placeholder="0-99"
                                                                min="0"
                                                                max="99"
                                                                style={{ width: 64, textAlign: "center", padding: "6px" }}
                                                            />
                                                            <button
                                                                type="button"
                                                                className="admin-btn admin-btn-ghost admin-btn-sm"
                                                                onClick={() => setTeamRemovalPrompt({ team: t, index })}
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
                                </div>

                                </div>

                                <div style={{ display: "flex", gap: 10, marginTop: 16, paddingTop: 16, borderTop: "1px solid #e8eaef", justifyContent: "flex-end", flexShrink: 0 }}>
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
