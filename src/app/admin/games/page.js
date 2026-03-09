"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

export default function AdminGamesPage() {
    const { user } = useAuth();
    const [orgs, setOrgs] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState("");
    const [seasons, setSeasons] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState("");
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(false);
    const { showSuccess, showError } = useToast();

    const fetchOrgs = useCallback(async () => {
        try {
            const res = await fetch("/api/organizations");
            const data = await res.json();
            if (data.success) setOrgs(data.data);
        } catch { showError("Failed to load organizations"); }
    }, []);

    useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

    useEffect(() => {
        if (!selectedOrg) { setSeasons([]); setSelectedSeason(""); setGames([]); return; }
        (async () => {
            const res = await fetch(`/api/organizations/${selectedOrg}/seasons`);
            const data = await res.json();
            if (data.success) setSeasons(data.data);
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
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <label className="admin-form-label">Organization</label>
                                <select className="admin-form-select" value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}>
                                    <option value="">Select organization...</option>
                                    {orgs.map(o => <option key={o.slug} value={o.slug}>{o.name}</option>)}
                                </select>
                            </div>
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
                        <div className="admin-card-header">
                            <h3>Games {selectedSeason ? `(${games.length})` : ""}</h3>
                        </div>

                        {!selectedSeason ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-filter"></i>
                                <p>Select an organization and season to view games.</p>
                            </div>
                        ) : loading ? (
                            <div className="admin-card-body" style={{ textAlign: "center", color: "rgba(255,255,255,0.4)" }}>
                                Loading games...
                            </div>
                        ) : games.length === 0 ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-football"></i>
                                <p>No games in this season yet.</p>
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
                                            <th style={{ width: 80 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {games.map(game => (
                                            <tr key={game._id}>
                                                <td>{new Date(game.date).toLocaleDateString()}</td>
                                                <td>{game.time}</td>
                                                <td style={{ fontWeight: 600 }}>{game.teamA.name}</td>
                                                <td style={{ fontWeight: 600 }}>{game.teamB.name}</td>
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
                                                    <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteGame(game._id)}>
                                                        <i className="fa-solid fa-trash"></i>
                                                    </button>
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
        </AdminLayout>
    );
}
