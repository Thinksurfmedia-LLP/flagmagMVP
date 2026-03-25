"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout, { hasAccess, hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
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
        // Pre-populate from page filter
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
                        <option value="cancelled">Cancelled</option>
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

    // Find the Team doc matching the active team name
    const teamDoc = teams.find(t => t.name.toLowerCase() === activeTeam.toLowerCase());
    const teamPlayers = teamDoc?.players || [];

    // Fetch existing stats when team or statType changes
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const res = await fetch(`/api/games/${game._id}/stats?teamName=${encodeURIComponent(activeTeam)}&statType=${statType}`);
                const data = await res.json();
                const existingStats = data.success ? data.data : [];

                // Build stat rows: one per player on the team
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

                {/* Team toggle + Stat type selector */}
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

                {/* Stats table */}
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

                {/* Actions */}
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

/* ── Play-recording sub-forms for the LiveStatsModal ── */
const PLAY_FORMS = {
    Completion: { fields: ["passer", "receiver", "yards", "points", "flagPull"], label: "Complete Pass" },
    Incompletion: { fields: ["passer"], label: "Incomplete Pass" },
    Interception: { fields: ["passer", "defender", "points", "flagPull"], label: "Interception" },
    Sack: { fields: ["passer", "defender", "safety"], label: "Sack" },
    Fumble: { fields: ["defender", "points", "flagPull"], label: "Fumble" },
    Run: { fields: ["rusher", "yards", "points", "flagPull"], label: "Run" },
};
const POINTS_OPTIONS = ["None", "Touch Down", "1 Pt.", "2 Pt."];
const POINTS_OPTIONS_NO_1PT = ["None", "Touch Down", "2 Pt."];

function PlayFormInline({ type, roster, activeTeam, onSave, onCancel }) {
    const config = PLAY_FORMS[type];
    const players = activeTeam === "A" ? (roster.teamA || []) : (roster.teamB || []);
    const playerNames = players.map(p => p.name || p.jerseyNumber || "Unknown");

    const [form, setForm] = useState({
        passer: "", receiver: "", rusher: "", defender: "",
        yards: "", points: "None", flagPull: "", safety: false,
    });

    const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
    const pointsOpts = ["Completion", "Run"].includes(type) ? POINTS_OPTIONS : POINTS_OPTIONS_NO_1PT;

    return (
        <div style={{ background: "#f8f9fb", border: "1px solid #e0e3ea", borderRadius: 8, padding: 16, marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1a1d26" }}>{config.label}</h4>
                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={onCancel} style={{ fontSize: 12 }}>Cancel</button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {config.fields.includes("passer") && (
                    <div className="admin-form-group" style={{ flex: "1 1 140px", marginBottom: 0 }}>
                        <label className="admin-form-label" style={{ fontSize: 12 }}>Passer</label>
                        <select className="admin-form-select" style={{ fontSize: 13 }} value={form.passer} onChange={e => set("passer", e.target.value)}>
                            <option value="">Select...</option>
                            {playerNames.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                )}
                {config.fields.includes("receiver") && (
                    <div className="admin-form-group" style={{ flex: "1 1 140px", marginBottom: 0 }}>
                        <label className="admin-form-label" style={{ fontSize: 12 }}>Receiver</label>
                        <select className="admin-form-select" style={{ fontSize: 13 }} value={form.receiver} onChange={e => set("receiver", e.target.value)}>
                            <option value="">Select...</option>
                            {playerNames.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                )}
                {config.fields.includes("rusher") && (
                    <div className="admin-form-group" style={{ flex: "1 1 140px", marginBottom: 0 }}>
                        <label className="admin-form-label" style={{ fontSize: 12 }}>Rusher</label>
                        <select className="admin-form-select" style={{ fontSize: 13 }} value={form.rusher} onChange={e => set("rusher", e.target.value)}>
                            <option value="">Select...</option>
                            {playerNames.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                )}
                {config.fields.includes("defender") && (
                    <div className="admin-form-group" style={{ flex: "1 1 140px", marginBottom: 0 }}>
                        <label className="admin-form-label" style={{ fontSize: 12 }}>Defender</label>
                        <select className="admin-form-select" style={{ fontSize: 13 }} value={form.defender} onChange={e => set("defender", e.target.value)}>
                            <option value="">Select...</option>
                            {playerNames.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                )}
                {config.fields.includes("yards") && (
                    <div className="admin-form-group" style={{ flex: "0 1 90px", marginBottom: 0 }}>
                        <label className="admin-form-label" style={{ fontSize: 12 }}>Yards</label>
                        <input type="number" className="admin-form-input" style={{ fontSize: 13 }} value={form.yards} onChange={e => set("yards", e.target.value)} />
                    </div>
                )}
                {config.fields.includes("points") && (
                    <div className="admin-form-group" style={{ flex: "1 1 130px", marginBottom: 0 }}>
                        <label className="admin-form-label" style={{ fontSize: 12 }}>Points</label>
                        <select className="admin-form-select" style={{ fontSize: 13 }} value={form.points} onChange={e => {
                            set("points", e.target.value);
                            if (e.target.value !== "None") set("flagPull", "");
                        }}>
                            {pointsOpts.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    </div>
                )}
                {config.fields.includes("flagPull") && form.points === "None" && (
                    <div className="admin-form-group" style={{ flex: "1 1 140px", marginBottom: 0 }}>
                        <label className="admin-form-label" style={{ fontSize: 12 }}>Flag Pull By</label>
                        <select className="admin-form-select" style={{ fontSize: 13 }} value={form.flagPull} onChange={e => set("flagPull", e.target.value)}>
                            <option value="">Select...</option>
                            {playerNames.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </div>
                )}
                {config.fields.includes("safety") && (
                    <div className="admin-form-group" style={{ flex: "0 1 120px", marginBottom: 0, display: "flex", alignItems: "flex-end", gap: 6 }}>
                        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                            <input type="checkbox" checked={form.safety} onChange={e => set("safety", e.target.checked)} />
                            Safety
                        </label>
                    </div>
                )}
            </div>
            <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => onSave(form)}>
                    Save Play
                </button>
            </div>
        </div>
    );
}

function LiveStatsModal({ game, onClose, onGameUpdate }) {
    const { showSuccess, showError } = useToast();
    const [activeTeam, setActiveTeam] = useState("A");
    const [half, setHalf] = useState("1st");
    const [timeoutsA, setTimeoutsA] = useState(0);
    const [timeoutsB, setTimeoutsB] = useState(0);
    const [currentPlay, setCurrentPlay] = useState(null);
    const [liveGame, setLiveGame] = useState(game);
    const [roster, setRoster] = useState({ teamA: [], teamB: [] });
    const [persistedPlays, setPersistedPlays] = useState([]);
    const [loadingPlays, setLoadingPlays] = useState(true);
    const [editingPlayId, setEditingPlayId] = useState(null);
    const [editForm, setEditForm] = useState({});
    const [savingEdit, setSavingEdit] = useState(false);
    const [activeTab, setActiveTab] = useState("record"); // "record" or "plays"

    const teamAScore = liveGame.teamA?.score ?? 0;
    const teamBScore = liveGame.teamB?.score ?? 0;

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/games/${game._id}/roster`);
                const data = await res.json();
                if (data.success && data.data) setRoster(data.data);
            } catch { /* ignore */ }
        })();
    }, [game._id]);

    const fetchPlays = useCallback(async () => {
        try {
            const res = await fetch(`/api/games/${game._id}/plays`);
            const data = await res.json();
            if (data.success) setPersistedPlays(data.data);
        } catch { /* ignore */ }
        finally { setLoadingPlays(false); }
    }, [game._id]);

    useEffect(() => { fetchPlays(); }, [fetchPlays]);

    const refreshGame = async () => {
        try {
            const res = await fetch(`/api/games/${game._id}`);
            const data = await res.json();
            if (data.success) setLiveGame(data.data);
        } catch { /* ignore */ }
    };

    const updateScore = async (team, delta) => {
        const field = team === "A" ? "teamA" : "teamB";
        const currentScore = liveGame[field].score || 0;
        const newScore = Math.max(0, currentScore + delta);
        try {
            await fetch(`/api/games/${game._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [`${field}.score`]: newScore }),
            });
            refreshGame();
        } catch { /* ignore */ }
    };

    const persistPlay = async (playType, logEntry, playData) => {
        try {
            await fetch(`/api/games/${game._id}/plays`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: playType,
                    activeTeam: logEntry.activeTeam,
                    teamName: logEntry.team,
                    half: logEntry.half,
                    passer: playData.passer || "",
                    receiver: playData.receiver || "",
                    rusher: playData.rusher || "",
                    defender: playData.defender || "",
                    flagPull: playData.flagPull || "",
                    yards: Number(playData.yards) || 0,
                    points: playData.points || "",
                    safety: Boolean(playData.safety),
                    ptsAdded: logEntry.ptsAdded,
                    targetTeam: logEntry.targetTeam,
                }),
            });
            fetchPlays();
        } catch (err) {
            console.error("Failed to persist play:", err);
        }
    };

    const handlePlaySave = (type, data) => {
        let ptsToAdd = 0;
        let targetTeam = activeTeam;

        if (type === "Completion" || type === "Run") {
            if (data.points === "Touch Down") ptsToAdd = 6;
            if (data.points === "1 Pt.") ptsToAdd = 1;
            if (data.points === "2 Pt.") ptsToAdd = 2;
            if (data.flagPull && data.flagPull.trim() !== "") ptsToAdd = 0;
        } else if (type === "Fumble" || type === "Interception") {
            if (data.points === "Touch Down") ptsToAdd = 6;
            if (data.points === "2 Pt.") ptsToAdd = 2;
            if (data.flagPull && data.flagPull.trim() !== "") ptsToAdd = 0;
            targetTeam = activeTeam === "A" ? "B" : "A";
        } else if (type === "Sack") {
            if (data.safety) ptsToAdd = 2;
            targetTeam = activeTeam === "A" ? "B" : "A";
        }

        if (ptsToAdd !== 0) updateScore(targetTeam, ptsToAdd);

        const teamName = activeTeam === "A" ? liveGame.teamA.name : liveGame.teamB.name;
        const logEntry = {
            activeTeam,
            team: teamName,
            half,
            ptsAdded: ptsToAdd,
            targetTeam,
        };

        persistPlay(type.toLowerCase(), logEntry, data);
        setCurrentPlay(null);
        showSuccess(`${type} recorded for ${teamName}`);
    };

    const handleStartGame = async () => {
        try {
            if (liveGame.status === "upcoming") {
                await fetch(`/api/games/${game._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: "in_progress" }),
                });
                showSuccess("Game started!");
                refreshGame();
                if (onGameUpdate) onGameUpdate();
            }
        } catch { showError("Failed to start game"); }
    };

    const handleCompleteGame = async () => {
        if (!confirm("Are you sure you want to mark this game as completed?")) return;
        try {
            await fetch(`/api/games/${game._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "completed" }),
            });
            showSuccess("Game completed!");
            refreshGame();
            if (onGameUpdate) onGameUpdate();
        } catch { showError("Failed to complete game"); }
    };

    const handleCancelGame = async () => {
        if (!confirm("Are you sure you want to cancel this game? This cannot be undone.")) return;
        try {
            await fetch(`/api/games/${game._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "cancelled" }),
            });
            showSuccess("Game cancelled.");
            refreshGame();
            if (onGameUpdate) onGameUpdate();
        } catch { showError("Failed to cancel game"); }
    };

    const handleDeletePlay = async (playId) => {
        if (!confirm("Delete this play?")) return;
        try {
            const res = await fetch(`/api/games/${game._id}/plays?playId=${playId}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                showSuccess("Play deleted");
                fetchPlays();
                refreshGame();
            } else { showError(data.error || "Failed to delete play"); }
        } catch { showError("Failed to delete play"); }
    };

    const startEditPlay = (play) => {
        setEditingPlayId(play._id);
        setEditForm({
            type: play.type,
            activeTeam: play.activeTeam,
            teamName: play.teamName,
            half: play.half,
            passer: play.passer || "",
            receiver: play.receiver || "",
            rusher: play.rusher || "",
            defender: play.defender || "",
            flagPull: play.flagPull || "",
            yards: play.yards || 0,
            points: play.points || "",
            safety: play.safety || false,
        });
    };

    const handleSaveEdit = async () => {
        setSavingEdit(true);
        try {
            const res = await fetch(`/api/games/${game._id}/plays?playId=${editingPlayId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(editForm),
            });
            const data = await res.json();
            if (data.success) {
                showSuccess("Play updated");
                setEditingPlayId(null);
                fetchPlays();
            } else { showError(data.error || "Failed to update play"); }
        } catch { showError("Failed to update play"); }
        finally { setSavingEdit(false); }
    };

    const rosterPlayersA = roster.teamA || [];
    const rosterPlayersB = roster.teamB || [];
    const allPlayerNames = [...rosterPlayersA, ...rosterPlayersB].map(p => p.name || p.jerseyNumber || "Unknown");

    const statActions = [
        { icon: "fa-solid fa-bullseye", label: "Completion", action: "Completion" },
        { icon: "fa-solid fa-xmark", label: "Incompletion", action: "Incompletion" },
        { icon: "fa-solid fa-hand", label: "Interception", action: "Interception" },
        { icon: "fa-solid fa-down-long", label: "Sack", action: "Sack" },
        { icon: "fa-solid fa-football", label: "Fumble", action: "Fumble" },
        { icon: "fa-solid fa-person-running", label: "Run", action: "Run" },
    ];

    const playTypeLabel = (type) => {
        const map = { completion: "Completion", incomplete: "Incompletion", interception: "Interception", sack: "Sack", fumble: "Fumble", run: "Run" };
        return map[type] || type;
    };

    const playDescription = (play) => {
        switch (play.type) {
            case "completion": return `${play.yards || 0}yd P:${play.passer || "?"} R:${play.receiver || "?"}`;
            case "incomplete": return `P:${play.passer || "?"}`;
            case "interception": return `P:${play.passer || "?"} D:${play.defender || "?"}`;
            case "sack": return `P:${play.passer || "?"} D:${play.defender || "?"}${play.safety ? " (Safety)" : ""}`;
            case "fumble": return `D:${play.defender || "?"}`;
            case "run": return `${play.yards || 0}yd R:${play.rusher || "?"}`;
            default: return play.type;
        }
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 className="admin-modal-title" style={{ margin: 0 }}>
                        Live Stats — {liveGame.teamA.name} vs {liveGame.teamB.name}
                    </h3>
                    <span className={`admin-badge ${liveGame.status === "completed" ? "player" : liveGame.status === "in_progress" ? "organizer" : liveGame.status === "cancelled" ? "danger" : ""}`}>
                        {liveGame.status}
                    </span>
                </div>

                {/* Score display */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24, padding: "12px 0", background: "#f0f2f5", borderRadius: 8, marginBottom: 12 }}>
                    <div style={{ textAlign: "center", minWidth: 100 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#1a1d26" }}>{liveGame.teamA.name}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "#1a1d26" }}>{teamAScore}</div>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#6b7280" }}>VS</div>
                    <div style={{ textAlign: "center", minWidth: 100 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#1a1d26" }}>{liveGame.teamB.name}</div>
                        <div style={{ fontSize: 28, fontWeight: 800, color: "#1a1d26" }}>{teamBScore}</div>
                    </div>
                </div>

                {/* Tabs: Record Stats | Game Plays */}
                <div style={{ display: "flex", gap: 0, marginBottom: 12, borderBottom: "2px solid #e8eaef" }}>
                    <button
                        onClick={() => setActiveTab("record")}
                        style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, border: "none", background: "none", cursor: "pointer", color: activeTab === "record" ? "#ff1e00" : "#6b7280", borderBottom: activeTab === "record" ? "2px solid #ff1e00" : "2px solid transparent", marginBottom: -2 }}
                    >
                        <i className="fa-solid fa-plus-circle" style={{ marginRight: 6 }}></i>Record Stats
                    </button>
                    <button
                        onClick={() => setActiveTab("plays")}
                        style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, border: "none", background: "none", cursor: "pointer", color: activeTab === "plays" ? "#ff1e00" : "#6b7280", borderBottom: activeTab === "plays" ? "2px solid #ff1e00" : "2px solid transparent", marginBottom: -2 }}
                    >
                        <i className="fa-solid fa-list" style={{ marginRight: 6 }}></i>Game Plays ({persistedPlays.length})
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: "auto" }}>
                    {/* ──── Record Stats Tab ──── */}
                    {activeTab === "record" && (
                        <>
                            {/* Active team selector + half */}
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                    <span style={{ fontSize: 12, color: "#6b7280", marginRight: 4 }}>Offense:</span>
                                    <button className={`admin-btn admin-btn-sm ${activeTeam === "A" ? "admin-btn-primary" : "admin-btn-ghost"}`} onClick={() => setActiveTeam("A")}>
                                        {liveGame.teamA.name}
                                    </button>
                                    <button className={`admin-btn admin-btn-sm ${activeTeam === "B" ? "admin-btn-primary" : "admin-btn-ghost"}`} onClick={() => setActiveTeam("B")}>
                                        {liveGame.teamB.name}
                                    </button>
                                </div>
                                <div style={{ display: "flex", gap: 0 }}>
                                    <button
                                        onClick={() => setHalf("1st")}
                                        style={{ padding: "4px 14px", fontSize: 12, fontWeight: 600, border: "1px solid #d0d5dd", borderRadius: "6px 0 0 6px", cursor: "pointer", background: half === "1st" ? "#ff1e00" : "#fff", color: half === "1st" ? "#fff" : "#6b7280" }}
                                    >1st Half</button>
                                    <button
                                        onClick={() => setHalf("2nd")}
                                        style={{ padding: "4px 14px", fontSize: 12, fontWeight: 600, border: "1px solid #d0d5dd", borderLeft: "none", borderRadius: "0 6px 6px 0", cursor: "pointer", background: half === "2nd" ? "#ff1e00" : "#fff", color: half === "2nd" ? "#fff" : "#6b7280" }}
                                    >2nd Half</button>
                                </div>
                            </div>

                            {/* Start game button if upcoming */}
                            {liveGame.status === "upcoming" && (
                                <div style={{ textAlign: "center", padding: "12px 0" }}>
                                    <button className="admin-btn admin-btn-danger" onClick={handleStartGame}>
                                        <i className="fa-solid fa-play"></i> Start Game
                                    </button>
                                </div>
                            )}

                            {/* Stat action buttons */}
                            {liveGame.status !== "upcoming" && (
                                <>
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 12 }}>
                                        {statActions.map(sa => (
                                            <button
                                                key={sa.action}
                                                className={`admin-btn admin-btn-sm ${currentPlay === sa.action ? "admin-btn-primary" : "admin-btn-ghost"}`}
                                                onClick={() => setCurrentPlay(currentPlay === sa.action ? null : sa.action)}
                                                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 4px", fontSize: 11 }}
                                            >
                                                <i className={sa.icon} style={{ fontSize: 16 }}></i>
                                                {sa.label}
                                            </button>
                                        ))}
                                    </div>

                                    {currentPlay && (
                                        <PlayFormInline
                                            type={currentPlay}
                                            roster={roster}
                                            activeTeam={activeTeam}
                                            onSave={(data) => handlePlaySave(currentPlay, data)}
                                            onCancel={() => setCurrentPlay(null)}
                                        />
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {/* ──── Game Plays Tab ──── */}
                    {activeTab === "plays" && (
                        <div>
                            {loadingPlays ? (
                                <div className="admin-loading"><div className="admin-spinner"></div>Loading plays...</div>
                            ) : persistedPlays.length === 0 ? (
                                <div className="admin-empty" style={{ padding: "30px 0" }}>
                                    <i className="fa-solid fa-clipboard"></i>
                                    <p>No plays recorded for this game yet.</p>
                                </div>
                            ) : (
                                <div style={{ border: "1px solid #e8eaef", borderRadius: 6, overflow: "hidden" }}>
                                    <table className="admin-table" style={{ fontSize: 12, marginBottom: 0 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ width: 30 }}>#</th>
                                                <th>Type</th>
                                                <th>Details</th>
                                                <th>Team</th>
                                                <th>Half</th>
                                                <th style={{ textAlign: "center" }}>Yds</th>
                                                <th>Points</th>
                                                <th style={{ width: 80, textAlign: "center" }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {persistedPlays.map((play, idx) => (
                                                editingPlayId === play._id ? (
                                                    <tr key={play._id} style={{ background: "#fffbe6" }}>
                                                        <td>{idx + 1}</td>
                                                        <td>
                                                            <select style={{ fontSize: 12, padding: "2px 4px", border: "1px solid #d0d5dd", borderRadius: 4 }} value={editForm.type} onChange={e => setEditForm(prev => ({ ...prev, type: e.target.value }))}>
                                                                {["completion", "incomplete", "interception", "sack", "fumble", "run"].map(t => (
                                                                    <option key={t} value={t}>{playTypeLabel(t)}</option>
                                                                ))}
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                                                {["completion", "incomplete", "interception", "sack"].includes(editForm.type) && (
                                                                    <input placeholder="Passer" style={{ width: 70, fontSize: 11, padding: "2px 4px", border: "1px solid #d0d5dd", borderRadius: 4 }} value={editForm.passer} onChange={e => setEditForm(prev => ({ ...prev, passer: e.target.value }))} />
                                                                )}
                                                                {editForm.type === "completion" && (
                                                                    <input placeholder="Receiver" style={{ width: 70, fontSize: 11, padding: "2px 4px", border: "1px solid #d0d5dd", borderRadius: 4 }} value={editForm.receiver} onChange={e => setEditForm(prev => ({ ...prev, receiver: e.target.value }))} />
                                                                )}
                                                                {editForm.type === "run" && (
                                                                    <input placeholder="Rusher" style={{ width: 70, fontSize: 11, padding: "2px 4px", border: "1px solid #d0d5dd", borderRadius: 4 }} value={editForm.rusher} onChange={e => setEditForm(prev => ({ ...prev, rusher: e.target.value }))} />
                                                                )}
                                                                {["interception", "sack", "fumble"].includes(editForm.type) && (
                                                                    <input placeholder="Defender" style={{ width: 70, fontSize: 11, padding: "2px 4px", border: "1px solid #d0d5dd", borderRadius: 4 }} value={editForm.defender} onChange={e => setEditForm(prev => ({ ...prev, defender: e.target.value }))} />
                                                                )}
                                                                <input placeholder="Flag Pull" style={{ width: 70, fontSize: 11, padding: "2px 4px", border: "1px solid #d0d5dd", borderRadius: 4 }} value={editForm.flagPull} onChange={e => setEditForm(prev => ({ ...prev, flagPull: e.target.value }))} />
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <select style={{ fontSize: 11, padding: "2px 4px", border: "1px solid #d0d5dd", borderRadius: 4 }} value={editForm.activeTeam} onChange={e => setEditForm(prev => ({ ...prev, activeTeam: e.target.value, teamName: e.target.value === "A" ? liveGame.teamA.name : liveGame.teamB.name }))}>
                                                                <option value="A">{liveGame.teamA.name}</option>
                                                                <option value="B">{liveGame.teamB.name}</option>
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <select style={{ fontSize: 11, padding: "2px 4px", border: "1px solid #d0d5dd", borderRadius: 4 }} value={editForm.half} onChange={e => setEditForm(prev => ({ ...prev, half: e.target.value }))}>
                                                                <option value="1st">1st</option>
                                                                <option value="2nd">2nd</option>
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <input type="number" style={{ width: 50, fontSize: 11, padding: "2px 4px", border: "1px solid #d0d5dd", borderRadius: 4, textAlign: "center" }} value={editForm.yards} onChange={e => setEditForm(prev => ({ ...prev, yards: e.target.value }))} />
                                                        </td>
                                                        <td>
                                                            <select style={{ fontSize: 11, padding: "2px 4px", border: "1px solid #d0d5dd", borderRadius: 4 }} value={editForm.points} onChange={e => setEditForm(prev => ({ ...prev, points: e.target.value }))}>
                                                                <option value="">None</option>
                                                                <option value="None">None</option>
                                                                <option value="Touch Down">TD</option>
                                                                <option value="1 Pt.">1 Pt</option>
                                                                <option value="2 Pt.">2 Pt</option>
                                                            </select>
                                                        </td>
                                                        <td>
                                                            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                                                <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={handleSaveEdit} disabled={savingEdit} title="Save" style={{ padding: "2px 8px", fontSize: 11 }}>
                                                                    <i className="fa-solid fa-check"></i>
                                                                </button>
                                                                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setEditingPlayId(null)} title="Cancel" style={{ padding: "2px 8px", fontSize: 11 }}>
                                                                    <i className="fa-solid fa-times"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    <tr key={play._id}>
                                                        <td style={{ color: "#6b7280" }}>{idx + 1}</td>
                                                        <td>
                                                            <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: play.type === "completion" ? "#dcfce7" : play.type === "interception" ? "#fef3c7" : play.type === "sack" ? "#fee2e2" : play.type === "fumble" ? "#fee2e2" : play.type === "run" ? "#dbeafe" : "#f3f4f6", color: play.type === "completion" ? "#166534" : play.type === "interception" ? "#92400e" : play.type === "sack" ? "#991b1b" : play.type === "fumble" ? "#991b1b" : play.type === "run" ? "#1e40af" : "#374151" }}>
                                                                {playTypeLabel(play.type)}
                                                            </span>
                                                        </td>
                                                        <td style={{ fontSize: 12 }}>{playDescription(play)}</td>
                                                        <td>{play.teamName}</td>
                                                        <td>{play.half}</td>
                                                        <td style={{ textAlign: "center" }}>{play.yards || "—"}</td>
                                                        <td>{play.points && play.points !== "None" ? play.points : "—"}</td>
                                                        <td>
                                                            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                                                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => startEditPlay(play)} title="Edit" style={{ padding: "2px 8px", fontSize: 11 }}>
                                                                    <i className="fa-solid fa-pen"></i>
                                                                </button>
                                                                <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDeletePlay(play._id)} title="Delete" style={{ padding: "2px 8px", fontSize: 11 }}>
                                                                    <i className="fa-solid fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "space-between", borderTop: "1px solid #e8eaef", paddingTop: 16 }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Close</button>
                    {liveGame.status === "in_progress" && (
                        <div style={{ display: "flex", gap: 8 }}>
                            <button className="admin-btn admin-btn-ghost" onClick={handleCancelGame} style={{ color: "#dc2626" }}>
                                <i className="fa-solid fa-ban"></i> Cancel Game
                            </button>
                            <button className="admin-btn admin-btn-danger" onClick={handleCompleteGame}>
                                <i className="fa-solid fa-flag-checkered"></i> Complete Game
                            </button>
                        </div>
                    )}
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
    const [leagues, setLeagues] = useState([]);
    const [games, setGames] = useState([]);
    const [teams, setTeams] = useState([]);
    const [venues, setVenues] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [showLiveStats, setShowLiveStats] = useState(false);
    const [liveStatsTarget, setLiveStatsTarget] = useState(null);
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

    // Fetch all games across all leagues for the org
    const fetchAllGames = useCallback(async (leagueList) => {
        const leaguesToUse = leagueList || leagues;
        if (!leaguesToUse.length) { setGames([]); return; }
        setLoading(true);
        try {
            const results = await Promise.all(
                leaguesToUse.map(l => fetch(`/api/seasons/${l._id}/games`).then(r => r.json()))
            );
            const allGames = results
                .filter(r => r.success)
                .flatMap(r => r.data);
            allGames.sort((a, b) => new Date(a.date) - new Date(b.date));
            setGames(allGames);
        } catch { showError("Failed to load games"); }
        setLoading(false);
    }, [leagues]);

    // Fetch seasons + teams + venues + games when org changes
    useEffect(() => {
        if (!selectedOrg) { setSeasons([]); setLeagues([]); setGames([]); setTeams([]); setVenues([]); return; }
        (async () => {
            try {
                const [seasonRes, leagueRes, teamRes, venueRes] = await Promise.all([
                    fetch(`/api/organizations/${selectedOrg}/seasons`),
                    fetch(`/api/organizations/${selectedOrg}/leagues`),
                    fetch("/api/teams"),
                    fetch("/api/locations"),
                ]);
                const [seasonData, leagueData, teamData, venueData] = await Promise.all([
                    seasonRes.json(), leagueRes.json(), teamRes.json(), venueRes.json(),
                ]);
                if (seasonData.success) setSeasons(seasonData.data);
                let fetchedLeagues = [];
                if (leagueData.success) { setLeagues(leagueData.data); fetchedLeagues = leagueData.data; }
                if (teamData.success) setTeams(teamData.data);
                if (venueData.success) setVenues(venueData.data);
                // Fetch all games across all leagues
                if (fetchedLeagues.length) {
                    const results = await Promise.all(
                        fetchedLeagues.map(l => fetch(`/api/seasons/${l._id}/games`).then(r => r.json()))
                    );
                    const allGames = results.filter(r => r.success).flatMap(r => r.data);
                    allGames.sort((a, b) => new Date(a.date) - new Date(b.date));
                    setGames(allGames);
                } else {
                    setGames([]);
                }
            } catch { showError("Failed to load data"); }
        })();
    }, [selectedOrg]);

    const handleSave = async (payload) => {
        const { leagueId, ...gameData } = payload;
        try {
            if (editTarget) {
                // Include league if it changed
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
            // Refresh all games
            await fetchAllGames();
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

    const canView   = user && hasAnyAccess(user, ["manage_games", "game_view", "game_create", "game_update", "game_delete"]);
    const canCreate = user && hasAnyAccess(user, ["manage_games", "game_create"]);
    const canUpdate = user && hasAnyAccess(user, ["manage_games", "game_update"]);
    const canDelete = user && hasAnyAccess(user, ["manage_games", "game_delete"]);

    return (
        <AdminLayout title="Games">
            {!canView ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage games.</p>
                </div>
            ) : (
                <>
                    {/* Organization selector for super admins */}
                    {!isOrganizer && (
                        <div className="admin-card">
                            <div className="admin-card-body" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <label className="admin-form-label">Organization</label>
                                    <select className="admin-form-select" value={selectedOrg} onChange={e => setSelectedOrg(e.target.value)}>
                                        <option value="">Select organization...</option>
                                        {orgs.map(o => <option key={o.slug} value={o.slug}>{o.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Games List */}
                    <div className="admin-card">
                        <div className="admin-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h3>Games ({games.length})</h3>
                            {canCreate && (
                                <button className="admin-btn admin-btn-primary" onClick={() => { setEditTarget(null); setShowModal(true); }}>
                                    <i className="fa-solid fa-plus"></i> Schedule Game
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <div className="admin-loading">
                                <div className="admin-spinner"></div>
                                Loading games...
                            </div>
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
                                                <td style={{ fontWeight: 600 }}>{game.teamA.name}</td>
                                                <td style={{ fontWeight: 600 }}>{game.teamB.name}</td>
                                                <td>{game.location || "—"}</td>
                                                <td>
                                                    <span className={`admin-badge ${game.status === "completed" ? "player" : game.status === "in_progress" ? "organizer" : game.status === "cancelled" ? "danger" : ""}`}>
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
                                                        <button
                                                            className="admin-btn admin-btn-ghost admin-btn-sm"
                                                            onClick={() => { setLiveStatsTarget(game); setShowLiveStats(true); }}
                                                            title="Record Live Stats"
                                                            style={{ color: "#ff1e00" }}
                                                        >
                                                            <i className="fa-solid fa-play-circle"></i>
                                                        </button>
                                                        {canUpdate && (
                                                            <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => { setEditTarget(game); setShowModal(true); }} title="Edit">
                                                                <i className="fa-solid fa-pen"></i>
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteGame(game._id)} title="Delete">
                                                                <i className="fa-solid fa-trash"></i>
                                                            </button>
                                                        )}
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
                    pageSelectedSeason=""
                    onClose={() => { setShowModal(false); setEditTarget(null); }}
                    onSave={handleSave}
                />
            )}
            {showLiveStats && liveStatsTarget && (
                <LiveStatsModal
                    game={liveStatsTarget}
                    onClose={() => { setShowLiveStats(false); setLiveStatsTarget(null); }}
                    onGameUpdate={() => fetchAllGames()}
                />
            )}
        </AdminLayout>
    );
}
