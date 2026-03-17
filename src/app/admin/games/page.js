"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

function GameModal({ onClose, onSave, initial, teams = [], venues = [] }) {
    const [form, setForm] = useState({
        date: initial?.date ? new Date(initial.date).toISOString().split("T")[0] : "",
        time: initial?.time || "",
        teamAName: initial?.teamA?.name || "",
        teamBName: initial?.teamB?.name || "",
        location: initial?.location || "",
        status: initial?.status || "upcoming",
        teamAScore: initial?.teamA?.score ?? "",
        teamBScore: initial?.teamB?.score ?? "",
    });
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        if (!form.date) return;
        if (!form.teamAName || !form.teamBName) return;
        setSaving(true);
        const payload = {
            date: form.date,
            time: form.time,
            teamA: { name: form.teamAName, logo: teams.find(t => t.name === form.teamAName)?.logo || "", score: form.teamAScore !== "" ? Number(form.teamAScore) : null },
            teamB: { name: form.teamBName, logo: teams.find(t => t.name === form.teamBName)?.logo || "", score: form.teamBScore !== "" ? Number(form.teamBScore) : null },
            location: form.location,
            status: form.status,
        };
        await onSave(payload);
        setSaving(false);
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <h3 className="admin-modal-title">{initial ? "Edit Game" : "Add Game"}</h3>
                <div style={{ display: "flex", gap: 12 }}>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                        <label className="admin-form-label">Date *</label>
                        <input type="date" className="admin-form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                    </div>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                        <label className="admin-form-label">Time</label>
                        <input className="admin-form-input" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} placeholder="e.g. 6:00 PM" />
                    </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                        <label className="admin-form-label">Team A *</label>
                        <select className="admin-form-select" value={form.teamAName} onChange={e => setForm({ ...form, teamAName: e.target.value })}>
                            <option value="">Select team...</option>
                            {teams.map(t => (
                                <option key={t._id} value={t.name}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                        <label className="admin-form-label">Team B *</label>
                        <select className="admin-form-select" value={form.teamBName} onChange={e => setForm({ ...form, teamBName: e.target.value })}>
                            <option value="">Select team...</option>
                            {teams.map(t => (
                                <option key={t._id} value={t.name}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Venue</label>
                    <select className="admin-form-select" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}>
                        <option value="">Select venue...</option>
                        {venues.map(v => (
                            <option key={v._id || v.name} value={v.name}>{v.name}{v.address ? ` — ${v.address}` : ""}</option>
                        ))}
                    </select>
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Status</label>
                    <select className="admin-form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                        <option value="upcoming">Upcoming</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                {form.status === "completed" && (
                    <div style={{ display: "flex", gap: 12 }}>
                        <div className="admin-form-group" style={{ flex: 1 }}>
                            <label className="admin-form-label">Team A Score</label>
                            <input type="number" className="admin-form-input" value={form.teamAScore} onChange={e => setForm({ ...form, teamAScore: e.target.value })} />
                        </div>
                        <div className="admin-form-group" style={{ flex: 1 }}>
                            <label className="admin-form-label">Team B Score</label>
                            <input type="number" className="admin-form-input" value={form.teamBScore} onChange={e => setForm({ ...form, teamBScore: e.target.value })} />
                        </div>
                    </div>
                )}
                <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving || !form.date || !form.teamAName || !form.teamBName}>
                        {saving ? "Saving..." : initial ? "Save Changes" : "Create Game"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminGamesPage() {
    const { user, activeRole } = useAuth();
    const [orgs, setOrgs] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState("");
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState("");
    const [games, setGames] = useState([]);
    const [teams, setTeams] = useState([]);
    const [venues, setVenues] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const { showSuccess, showError } = useToast();

    const effectiveRole = activeRole || user?.role;
    const isOrganizer = effectiveRole === "organizer" && user?.organization?.slug;

    const fetchOrgs = useCallback(async () => {
        if (isOrganizer) {
            setSelectedOrg(user.organization.slug);
            return;
        }
        try {
            const res = await fetch("/api/organizations");
            const data = await res.json();
            if (data.success) setOrgs(data.data);
        } catch { showError("Failed to load organizations"); }
    }, [isOrganizer, user?.organization?.slug]);

    useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

    // Fetch seasons + teams + venues when org changes
    useEffect(() => {
        if (!selectedOrg) { setSeasons([]); setSelectedSeason(""); setGames([]); setTeams([]); setVenues([]); return; }
        (async () => {
            try {
                const [seasonRes, teamRes, venueRes] = await Promise.all([
                    fetch(`/api/organizations/${selectedOrg}/seasons`),
                    fetch("/api/teams"),
                    fetch("/api/locations"),
                ]);
                const [seasonData, teamData, venueData] = await Promise.all([
                    seasonRes.json(), teamRes.json(), venueRes.json(),
                ]);
                if (seasonData.success) setSeasons(seasonData.data);
                if (teamData.success) setTeams(teamData.data);
                if (venueData.success) setVenues(venueData.data);
            } catch { showError("Failed to load data"); }
            setSelectedSeason(""); setGames([]);
        })();
    }, [selectedOrg]);

    useEffect(() => {
        if (!selectedSeason) { setGames([]); return; }
        setLoading(true);
        (async () => {
            const res = await fetch(`/api/seasons/${selectedSeason}/games`);
            const data = await res.json();
            if (data.success) setGames(data.data);
            setLoading(false);
        })();
    }, [selectedSeason]);

    const handleSave = async (payload) => {
        try {
            if (editTarget) {
                const res = await fetch(`/api/games/${editTarget._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error); return; }
                showSuccess("Game updated!");
            } else {
                const res = await fetch(`/api/seasons/${selectedSeason}/games`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error); return; }
                showSuccess("Game created!");
            }
            setShowModal(false);
            setEditTarget(null);
            // Refresh games
            const res = await fetch(`/api/seasons/${selectedSeason}/games`);
            const data = await res.json();
            if (data.success) setGames(data.data);
        } catch { showError("Failed to save game"); }
    };

    const deleteGame = async (gameId) => {
        if (!confirm("Delete this game?")) return;
        try {
            const res = await fetch(`/api/games/${gameId}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            setGames(prev => prev.filter(g => g._id !== gameId));
            showSuccess("Game deleted!");
        } catch { showError("Failed to delete game"); }
    };

    const canManage = user && hasAccess(user, "manage_games");

    return (
        <AdminLayout title="Games">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage games.</p>
                </div>
            ) : (
                <>
                    {/* Filters */}
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3>Filter Games</h3>
                        </div>
                        <div className="admin-card-body" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                            {!isOrganizer && (
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <label className="admin-form-label">Organization</label>
                                    <select className="admin-form-select" value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}>
                                        <option value="">Select organization...</option>
                                        {orgs.map(o => <option key={o.slug} value={o.slug}>{o.name}</option>)}
                                    </select>
                                </div>
                            )}
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <label className="admin-form-label">Season</label>
                                <select className="admin-form-select" value={selectedSeason} onChange={e => setSelectedSeason(e.target.value)} disabled={!selectedOrg}>
                                    <option value="">Select season...</option>
                                    {seasons.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Games List */}
                    <div className="admin-card">
                        <div className="admin-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3>Games {selectedSeason ? `(${games.length})` : ""}</h3>
                            {selectedSeason && (
                                <button className="admin-btn admin-btn-primary" onClick={() => { setEditTarget(null); setShowModal(true); }}>
                                    <i className="fa-solid fa-plus"></i> Add Game
                                </button>
                            )}
                        </div>

                        {!selectedSeason ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-filter"></i>
                                <p>{isOrganizer ? "Select a season to view games." : "Select an organization and season to view games."}</p>
                            </div>
                        ) : loading ? (
                            <div className="admin-loading">
                                <div className="admin-spinner"></div>
                                Loading games...
                            </div>
                        ) : games.length === 0 ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-football"></i>
                                <p>No games in this season yet. Add one to get started.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Time</th>
                                            <th>Team A</th>
                                            <th>Team B</th>
                                            <th>Venue</th>
                                            <th>Status</th>
                                            <th>Score</th>
                                            <th style={{ width: 120 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {games.map(game => (
                                            <tr key={game._id}>
                                                <td>{new Date(game.date).toLocaleDateString()}</td>
                                                <td>{game.time || "—"}</td>
                                                <td style={{ fontWeight: 600 }}>{game.teamA.name}</td>
                                                <td style={{ fontWeight: 600 }}>{game.teamB.name}</td>
                                                <td>{game.location || "—"}</td>
                                                <td>
                                                    <span className={`admin-badge ${game.status === "completed" ? "player" : game.status === "in_progress" ? "organizer" : ""}`}>
                                                        {game.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    {game.status === "completed"
                                                        ? `${game.teamA.score} - ${game.teamB.score}`
                                                        : "—"}
                                                </td>
                                                <td>
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => { setEditTarget(game); setShowModal(true); }} title="Edit">
                                                            <i className="fa-solid fa-pen"></i>
                                                        </button>
                                                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteGame(game._id)} title="Delete">
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
                </>
            )}
            {showModal && (
                <GameModal
                    initial={editTarget}
                    teams={teams}
                    venues={venues}
                    onClose={() => { setShowModal(false); setEditTarget(null); }}
                    onSave={handleSave}
                />
            )}
        </AdminLayout>
    );
}
