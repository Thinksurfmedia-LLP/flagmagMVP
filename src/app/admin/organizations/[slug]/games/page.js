"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";
import { useToast } from "@/components/AdminToast";

const STAT_FIELDS = ["rate", "atts", "comp", "tds", "pct", "xp2", "yards", "ten", "twenty", "forty", "ints", "intOpen", "intXp"];
const STAT_LABELS = { rate: "Rate", atts: "Atts", comp: "Comp", tds: "TDs", pct: "%", xp2: "XP2", yards: "Yards", ten: "10+", twenty: "20+", forty: "40+", ints: "INTs", intOpen: "Int Open", intXp: "Int XP" };

function GameModal({ onClose, onSave, initial, seasons = [], leagues = [], venues = [], teams = [], pageSelectedSeason = "" }) {
    // Cascading selection state
    const [selectedSeasonId, setSelectedSeasonId] = useState(() => {
        if (initial) {
            const league = leagues.find(l => l._id === initial.league);
            return league?.season?._id || league?.season || "";
        }
        if (pageSelectedSeason) {
            const league = leagues.find(l => l._id === pageSelectedSeason);
            if (league) return league.season?._id || league.season || "";
            if (seasons.find(s => s._id === pageSelectedSeason)) return pageSelectedSeason;
        }
        // Auto-select the first (default) season
        if (seasons.length > 0) return seasons[0]._id;
        return "";
    });
    const [selectedLeagueId, setSelectedLeagueId] = useState(() => {
        if (initial) return initial.league || "";
        if (pageSelectedSeason) {
            const league = leagues.find(l => l._id === pageSelectedSeason);
            if (league) return league._id;
        }
        return "";
    });
    const [selectedVenueName, setSelectedVenueName] = useState(() => {
        if (!initial?.location) return "";
        const loc = initial.location;
        const dashIdx = loc.indexOf(" - ");
        return dashIdx > -1 ? loc.substring(0, dashIdx) : loc;
    });
    const [selectedFieldName, setSelectedFieldName] = useState(() => {
        if (!initial?.location) return "";
        const loc = initial.location;
        const dashIdx = loc.indexOf(" - ");
        return dashIdx > -1 ? loc.substring(dashIdx + 3) : "";
    });

    const [form, setForm] = useState({
        date: initial?.date ? new Date(initial.date).toISOString().split("T")[0] : "",
        time: initial?.time || "",
        teamAName: initial?.teamA?.name || "",
        teamBName: initial?.teamB?.name || "",
        status: initial?.status || "upcoming",
        teamAScore: initial?.teamA?.score ?? "",
        teamBScore: initial?.teamB?.score ?? "",
    });
    const [saving, setSaving] = useState(false);

    // Derived values
    const filteredLeagues = leagues.filter(l => {
        const leagueSeasonId = l.season?._id || l.season;
        return leagueSeasonId === selectedSeasonId;
    });
    const selectedLeague = leagues.find(l => l._id === selectedLeagueId);
    // Use all org teams when a league is selected
    const leagueTeams = selectedLeague ? teams : [];
    const leagueVenueNames = selectedLeague?.locations || [];
    const leagueVenues = leagueVenueNames
        .map(name => venues.find(v => v.name.toLowerCase() === name.toLowerCase()))
        .filter(Boolean);
    const selectedVenue = venues.find(v => v.name === selectedVenueName);
    const showFieldDropdown = selectedVenue && selectedVenue.fields && selectedVenue.fields.length > 0;
    const composedLocation = selectedVenueName
        ? (selectedFieldName ? `${selectedVenueName} - ${selectedFieldName}` : selectedVenueName)
        : "";

    // Cascade reset handlers
    const handleSeasonChange = (seasonId) => {
        setSelectedSeasonId(seasonId);
        setSelectedLeagueId("");
        setForm(prev => ({ ...prev, teamAName: "", teamBName: "" }));
        setSelectedVenueName("");
        setSelectedFieldName("");
    };
    const handleLeagueChange = (leagueId) => {
        setSelectedLeagueId(leagueId);
        setForm(prev => ({ ...prev, teamAName: "", teamBName: "" }));
        setSelectedVenueName("");
        setSelectedFieldName("");
    };
    const handleVenueChange = (venueName) => {
        setSelectedVenueName(venueName);
        setSelectedFieldName("");
        const venue = venues.find(v => v.name === venueName);
        if (venue?.fields?.length === 1) setSelectedFieldName(venue.fields[0].name);
    };

    const handleSave = async () => {
        if (!form.date || !form.teamAName || !form.teamBName || !selectedLeagueId) return;
        setSaving(true);
        const teamAObj = leagueTeams.find(t => t.name === form.teamAName);
        const teamBObj = leagueTeams.find(t => t.name === form.teamBName);
        const payload = {
            leagueId: selectedLeagueId,
            date: form.date,
            time: form.time,
            teamA: { name: form.teamAName, logo: teamAObj?.logo || "", score: form.teamAScore !== "" ? Number(form.teamAScore) : null },
            teamB: { name: form.teamBName, logo: teamBObj?.logo || "", score: form.teamBScore !== "" ? Number(form.teamBScore) : null },
            location: composedLocation,
            status: form.status,
        };
        await onSave(payload);
        setSaving(false);
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
                <h3 className="admin-modal-title">{initial ? "Edit Game" : "Schedule Game"}</h3>

                {/* Season */}
                <div className="admin-form-group">
                    <label className="admin-form-label">Season *</label>
                    <select className="admin-form-select" value={selectedSeasonId} onChange={e => handleSeasonChange(e.target.value)}>
                        <option value="">Select season...</option>
                        {seasons.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                </div>

                {/* League */}
                <div className="admin-form-group">
                    <label className="admin-form-label">League *</label>
                    <select className="admin-form-select" value={selectedLeagueId} onChange={e => handleLeagueChange(e.target.value)} disabled={!selectedSeasonId}>
                        <option value="">Select league...</option>
                        {filteredLeagues.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                    </select>
                </div>

                {/* Team A & Team B */}
                <div style={{ display: "flex", gap: 12 }}>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                        <label className="admin-form-label">Team A *</label>
                        <select className="admin-form-select" value={form.teamAName} onChange={e => setForm({ ...form, teamAName: e.target.value })} disabled={!selectedLeagueId}>
                            <option value="">Select team...</option>
                            {leagueTeams.filter(t => t.name !== form.teamBName).map(t => (
                                <option key={t._id || t.name} value={t.name}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                        <label className="admin-form-label">Team B *</label>
                        <select className="admin-form-select" value={form.teamBName} onChange={e => setForm({ ...form, teamBName: e.target.value })} disabled={!selectedLeagueId}>
                            <option value="">Select team...</option>
                            {leagueTeams.filter(t => t.name !== form.teamAName).map(t => (
                                <option key={t._id || t.name} value={t.name}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Venue */}
                <div className="admin-form-group">
                    <label className="admin-form-label">Venue</label>
                    <select className="admin-form-select" value={selectedVenueName} onChange={e => handleVenueChange(e.target.value)} disabled={!selectedLeagueId}>
                        <option value="">Select venue...</option>
                        {leagueVenues.map(v => (
                            <option key={v._id} value={v.name}>{v.name}{v.address ? ` — ${v.address}` : ""}</option>
                        ))}
                    </select>
                </div>

                {/* Field (conditional) */}
                {showFieldDropdown && (
                    <div className="admin-form-group">
                        <label className="admin-form-label">Field</label>
                        <select className="admin-form-select" value={selectedFieldName} onChange={e => setSelectedFieldName(e.target.value)}>
                            <option value="">Select field...</option>
                            {selectedVenue.fields.map(f => (
                                <option key={f._id || f.name} value={f.name}>{f.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Date & Time */}
                <div style={{ display: "flex", gap: 12 }}>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                        <label className="admin-form-label">Date *</label>
                        <input type="date" className="admin-form-input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                    </div>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                        <label className="admin-form-label">Time</label>
                        <input type="time" className="admin-form-input" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
                    </div>
                </div>

                {/* Status */}
                <div className="admin-form-group">
                    <label className="admin-form-label">Status</label>
                    <select className="admin-form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                        <option value="upcoming">Upcoming</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>

                {/* Scores (when completed) */}
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
                    <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving || !form.date || !form.teamAName || !form.teamBName || !selectedLeagueId}>
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
    const [venues, setVenues] = useState([]);
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [statsTarget, setStatsTarget] = useState(null);

    useEffect(() => {
        if (!impersonatedOrg && slug) {
            fetch(`/api/organizations/${slug}`)
                .then(r => r.json())
                .then(d => { if (d.success) enterImpersonation(d.data); })
                .catch(() => {});
        }
    }, [slug, impersonatedOrg, enterImpersonation]);

    // Fetch seasons + leagues + teams + venues + all games for this org
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [seasonRes, leagueRes, teamRes, venueRes] = await Promise.all([
                fetch(`/api/organizations/${slug}/seasons`),
                fetch(`/api/organizations/${slug}/leagues`),
                fetch("/api/teams"),
                fetch("/api/locations"),
            ]);
            const [seasonData, leagueData, teamData, venueData] = await Promise.all([
                seasonRes.json(), leagueRes.json(), teamRes.json(), venueRes.json(),
            ]);
            if (seasonData.success) setSeasons(seasonData.data);
            if (teamData.success) setTeams(teamData.data);
            if (venueData.success) setVenues(venueData.data);

            const orgLeagues = leagueData.success ? leagueData.data : [];
            setLeagues(orgLeagues);

            // Fetch games for all leagues in parallel
            if (orgLeagues.length > 0) {
                const gameResponses = await Promise.all(
                    orgLeagues.map(l => fetch(`/api/seasons/${l._id}/games`).then(r => r.json()))
                );
                const allGames = gameResponses
                    .filter(d => d.success)
                    .flatMap(d => d.data);
                allGames.sort((a, b) => new Date(a.date) - new Date(b.date));
                setGames(allGames);
            } else {
                setGames([]);
            }
        } catch { showError("Failed to load data"); }
        finally { setLoading(false); }
    }, [slug]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleSave = async (payload) => {
        const { leagueId, ...gameData } = payload;
        try {
            if (editTarget) {
                if (leagueId && leagueId !== editTarget.league) {
                    gameData.league = leagueId;
                }
                const res = await fetch(`/api/games/${editTarget._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(gameData),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error); return; }
                showSuccess("Game updated!");
            } else {
                const res = await fetch(`/api/seasons/${leagueId}/games`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(gameData),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error); return; }
                showSuccess("Game scheduled!");
            }
            setShowModal(false);
            setEditTarget(null);
            fetchData();
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
                    {/* Games list */}
                    <div className="admin-card">
                        <div className="admin-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3>{orgName} &mdash; Games ({games.length})</h3>
                            <button className="admin-btn admin-btn-danger" onClick={() => { setEditTarget(null); setShowModal(true); }}>
                                <i className="fa-solid fa-plus"></i> Schedule Game
                            </button>
                        </div>

                        {loading ? (
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
                                            <th>League</th>
                                            <th>Team A</th>
                                            <th>Team B</th>
                                            <th>Venue</th>
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
                                                <td>{leagues.find(l => l._id === game.league)?.name || "—"}</td>
                                                <td style={{ fontWeight: 600 }}>{game.teamA.name}</td>
                                                <td style={{ fontWeight: 600 }}>{game.teamB.name}</td>
                                                <td>{game.location || "—"}</td>
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
                    seasons={seasons}
                    leagues={leagues}
                    venues={venues}
                    teams={teams}
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
