"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";
import { useToast } from "@/components/AdminToast";

function GameModal({ onClose, onSave, initial }) {
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
        setSaving(true);
        const payload = {
            date: form.date,
            time: form.time,
            teamA: { name: form.teamAName, score: form.teamAScore !== "" ? Number(form.teamAScore) : null },
            teamB: { name: form.teamBName, score: form.teamBScore !== "" ? Number(form.teamBScore) : null },
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
                        <input className="admin-form-input" value={form.teamAName} onChange={e => setForm({ ...form, teamAName: e.target.value })} placeholder="Team name" />
                    </div>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                        <label className="admin-form-label">Team B *</label>
                        <input className="admin-form-input" value={form.teamBName} onChange={e => setForm({ ...form, teamBName: e.target.value })} placeholder="Team name" />
                    </div>
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Location</label>
                    <input className="admin-form-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Venue / field" />
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
                    <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : initial ? "Save Changes" : "Create Game"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function OrgGamesPage() {
    const { slug } = useParams();
    const { user } = useAuth();
    const { org: impersonatedOrg, enterImpersonation } = useImpersonation();
    const { showSuccess, showError } = useToast();

    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState("");
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);
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

    // Fetch seasons for this org
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/organizations/${slug}/seasons`);
                const data = await res.json();
                if (data.success) setSeasons(data.data);
            } catch { showError("Failed to load seasons"); }
            finally { setInitialLoad(false); }
        })();
    }, [slug]);

    // Fetch games when season changes
    const fetchGames = useCallback(async () => {
        if (!selectedSeason) { setGames([]); return; }
        setLoading(true);
        try {
            const res = await fetch(`/api/seasons/${selectedSeason}/games`);
            const data = await res.json();
            if (data.success) setGames(data.data);
        } catch { showError("Failed to load games"); }
        finally { setLoading(false); }
    }, [selectedSeason]);

    useEffect(() => { fetchGames(); }, [fetchGames]);

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
            fetchGames();
        } catch { showError("Failed to save game"); }
    };

    const deleteGame = async (game) => {
        if (!confirm("Delete this game?")) return;
        try {
            const res = await fetch(`/api/games/${game._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            setGames(prev => prev.filter(g => g._id !== game._id));
            showSuccess("Game deleted!");
        } catch { showError("Failed to delete game"); }
    };

    const canManage = user && hasAccess(user, "manage_games");
    const orgName = impersonatedOrg?.name || slug;

    return (
        <AdminLayout title="Games">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage games.</p>
                </div>
            ) : (
                <>
                    {/* Season selector */}
                    <div className="admin-card" style={{ marginBottom: 16 }}>
                        <div className="admin-card-body" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <label className="admin-form-label">Season</label>
                                <select className="admin-form-select" value={selectedSeason} onChange={e => setSelectedSeason(e.target.value)}>
                                    <option value="">Select a season...</option>
                                    {seasons.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                </select>
                            </div>
                            {selectedSeason && (
                                <button className="admin-btn admin-btn-primary" style={{ alignSelf: "flex-end" }} onClick={() => { setEditTarget(null); setShowModal(true); }}>
                                    <i className="fa-solid fa-plus"></i> Add Game
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Games list */}
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3>{orgName} — Games {selectedSeason ? `(${games.length})` : ""}</h3>
                        </div>

                        {initialLoad ? (
                            <div className="admin-loading"><div className="admin-spinner"></div>Loading...</div>
                        ) : !selectedSeason ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-filter"></i>
                                <p>Select a season above to view and manage games.</p>
                            </div>
                        ) : loading ? (
                            <div className="admin-loading"><div className="admin-spinner"></div>Loading games...</div>
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
                                                <td>
                                                    <span className={`admin-badge ${game.status === "completed" ? "player" : game.status === "in_progress" ? "organizer" : ""}`}>
                                                        {game.status}
                                                    </span>
                                                </td>
                                                <td>{game.status === "completed" ? `${game.teamA.score} - ${game.teamB.score}` : "—"}</td>
                                                <td>
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => { setEditTarget(game); setShowModal(true); }} title="Edit">
                                                            <i className="fa-solid fa-pen"></i>
                                                        </button>
                                                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteGame(game)} title="Delete">
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
                    onClose={() => { setShowModal(false); setEditTarget(null); }}
                    onSave={handleSave}
                />
            )}
        </AdminLayout>
    );
}
