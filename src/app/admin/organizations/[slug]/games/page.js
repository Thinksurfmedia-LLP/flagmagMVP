"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";
import { useToast } from "@/components/AdminToast";

const STAT_FIELDS = ["rate", "atts", "comp", "tds", "pct", "xp2", "yards", "ten", "twenty", "forty", "ints", "intOpen", "intXp"];
const STAT_LABELS = { rate: "Rate", atts: "Atts", comp: "Comp", tds: "TDs", pct: "%", xp2: "XP2", yards: "Yards", ten: "10+", twenty: "20+", forty: "40+", ints: "INTs", intOpen: "Int Open", intXp: "Int XP" };

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
                <h3 className="admin-modal-title">{initial ? "Edit Game" : "Schedule Game"}</h3>
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
                        {saving ? "Saving..." : initial ? "Save Changes" : "Schedule Game"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function GameStatsModal({ game, teams, onClose }) {
    const { showSuccess, showError } = useToast();
    const [activeTeam, setActiveTeam] = useState(game.teamA.name);
    const [statType, setStatType] = useState("passing");
    const [playerStats, setPlayerStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const teamDoc = teams.find(t => t.name.toLowerCase() === activeTeam.toLowerCase());
    const teamPlayers = teamDoc?.players || [];

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const res = await fetch(`/api/games/${game._id}/stats?teamName=${encodeURIComponent(activeTeam)}&statType=${statType}`);
                const data = await res.json();
                const existingStats = data.success ? data.data : [];

                const rows = teamPlayers.map(p => {
                    const playerId = String(p._id || p);
                    const playerName = p.name || "Unknown";
                    const existing = existingStats.find(s => String(s.player?._id || s.player) === playerId);
                    const row = { player: playerId, playerName };
                    STAT_FIELDS.forEach(f => { row[f] = existing ? (existing[f] ?? 0) : 0; });
                    return row;
                });

                if (!cancelled) setPlayerStats(rows);
            } catch {
                if (!cancelled) setPlayerStats([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [activeTeam, statType, game._id, teamPlayers.length]);

    const updateStat = (index, field, value) => {
        setPlayerStats(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/games/${game._id}/stats`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    teamName: activeTeam,
                    statType,
                    stats: playerStats.map(ps => {
                        const entry = { player: ps.player };
                        STAT_FIELDS.forEach(f => { entry[f] = Number(ps[f]) || 0; });
                        return entry;
                    }),
                }),
            });
            const data = await res.json();
            if (data.success) {
                showSuccess(`Saved ${statType} stats for ${activeTeam}!`);
            } else {
                showError(data.error || "Failed to save stats");
            }
        } catch {
            showError("Failed to save stats");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 1100, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <h3 className="admin-modal-title" style={{ marginBottom: 16 }}>
                    Game Stats &mdash; {game.teamA.name} vs {game.teamB.name}
                    <span style={{ fontWeight: 400, fontSize: 13, marginLeft: 10, color: "#6b7280" }}>
                        {new Date(game.date).toLocaleDateString()}
                    </span>
                </h3>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                        {[game.teamA.name, game.teamB.name].map(tn => (
                            <button
                                key={tn}
                                className={`admin-btn admin-btn-sm ${activeTeam === tn ? "admin-btn-primary" : "admin-btn-ghost"}`}
                                onClick={() => setActiveTeam(tn)}
                            >
                                {tn}
                            </button>
                        ))}
                    </div>
                    <select
                        className="admin-form-select"
                        value={statType}
                        onChange={e => setStatType(e.target.value)}
                        style={{ width: "auto", minWidth: 140 }}
                    >
                        <option value="passing">Passing</option>
                        <option value="rushing">Rushing</option>
                        <option value="receiving">Receiving</option>
                    </select>
                </div>

                <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
                    {!teamDoc ? (
                        <div className="admin-empty" style={{ padding: "30px 0" }}>
                            <i className="fa-solid fa-triangle-exclamation"></i>
                            <p>No matching team found for &ldquo;{activeTeam}&rdquo;. Make sure a team with this name exists in the Teams section.</p>
                        </div>
                    ) : teamPlayers.length === 0 ? (
                        <div className="admin-empty" style={{ padding: "30px 0" }}>
                            <i className="fa-solid fa-users-slash"></i>
                            <p>No players assigned to {activeTeam}. Assign players in the Teams section first.</p>
                        </div>
                    ) : loading ? (
                        <div className="admin-loading">
                            <div className="admin-spinner"></div>
                            Loading stats...
                        </div>
                    ) : (
                        <table className="admin-table" style={{ fontSize: 13 }}>
                            <thead>
                                <tr>
                                    <th style={{ minWidth: 120, position: "sticky", left: 0, background: "#1a1d2d", zIndex: 1 }}>Player</th>
                                    {STAT_FIELDS.map(f => (
                                        <th key={f} style={{ textAlign: "center", minWidth: 60 }}>{STAT_LABELS[f]}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {playerStats.map((ps, i) => (
                                    <tr key={ps.player}>
                                        <td style={{ fontWeight: 600, position: "sticky", left: 0, background: "#12141f", zIndex: 1 }}>{ps.playerName}</td>
                                        {STAT_FIELDS.map(f => (
                                            <td key={f} style={{ padding: 2 }}>
                                                <input
                                                    type="number"
                                                    className="admin-form-input"
                                                    value={ps[f]}
                                                    onChange={e => updateStat(i, f, e.target.value)}
                                                    style={{ width: 60, padding: "4px 6px", fontSize: 12, textAlign: "center" }}
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16 }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Close</button>
                    {teamDoc && teamPlayers.length > 0 && (
                        <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
                            {saving ? "Saving..." : "Save Stats"}
                        </button>
                    )}
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
    const [leagues, setLeagues] = useState([]);
    const [teams, setTeams] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState("");
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [statsTarget, setStatsTarget] = useState(null);

    const seasonItems = seasons;
    const leagueItems = leagues;

    useEffect(() => {
        if (!impersonatedOrg && slug) {
            fetch(`/api/organizations/${slug}`)
                .then(r => r.json())
                .then(d => { if (d.success) enterImpersonation(d.data); })
                .catch(() => {});
        }
    }, [slug, impersonatedOrg, enterImpersonation]);

    // Fetch seasons + teams for this org
    useEffect(() => {
        (async () => {
            try {
                const [seasonRes, leagueRes, teamRes] = await Promise.all([
                    fetch(`/api/organizations/${slug}/seasons`),
                    fetch(`/api/organizations/${slug}/leagues`),
                    fetch("/api/teams"),
                ]);
                const [seasonData, leagueData, teamData] = await Promise.all([
                    seasonRes.json(), leagueRes.json(), teamRes.json(),
                ]);
                if (seasonData.success) setSeasons(seasonData.data);
                if (leagueData.success) setLeagues(leagueData.data);
                if (teamData.success) setTeams(teamData.data);
            } catch { showError("Failed to load data"); }
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
                showSuccess("Game scheduled!");
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
                    {/* Season / League selector */}
                    <div className="admin-card" style={{ marginBottom: 16 }}>
                        <div className="admin-card-body" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <label className="admin-form-label">Season / League</label>
                                <select className="admin-form-select" value={selectedSeason} onChange={e => setSelectedSeason(e.target.value)}>
                                    <option value="">Select season or league...</option>
                                    {seasonItems.length > 0 && (
                                        <optgroup label="Seasons">
                                            {seasonItems.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                        </optgroup>
                                    )}
                                    {leagueItems.length > 0 && (
                                        <optgroup label="Leagues">
                                            {leagueItems.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                            {selectedSeason && (
                                <button className="admin-btn admin-btn-primary" style={{ alignSelf: "flex-end" }} onClick={() => { setEditTarget(null); setShowModal(true); }}>
                                    <i className="fa-solid fa-plus"></i> Schedule Game
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Games list */}
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3>{orgName} &mdash; Games {selectedSeason ? `(${games.length})` : ""}</h3>
                        </div>

                        {initialLoad ? (
                            <div className="admin-loading"><div className="admin-spinner"></div>Loading...</div>
                        ) : !selectedSeason ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-filter"></i>
                                <p>Select a season or league above to view and manage games.</p>
                            </div>
                        ) : loading ? (
                            <div className="admin-loading"><div className="admin-spinner"></div>Loading games...</div>
                        ) : games.length === 0 ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-football"></i>
                                <p>No games scheduled yet. Add one to get started.</p>
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
                                            <th style={{ width: 140 }}>Actions</th>
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
                                                        {game.status === "completed" && (
                                                            <button
                                                                className="admin-btn admin-btn-ghost admin-btn-sm"
                                                                onClick={() => { setStatsTarget(game); setShowStatsModal(true); }}
                                                                title="Record Stats"
                                                            >
                                                                <i className="fa-solid fa-chart-bar"></i>
                                                            </button>
                                                        )}
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
            {showStatsModal && statsTarget && (
                <GameStatsModal
                    game={statsTarget}
                    teams={teams}
                    onClose={() => { setShowStatsModal(false); setStatsTarget(null); }}
                />
            )}
        </AdminLayout>
    );
}
