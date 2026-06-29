"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import AdminLayout, { hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";
import SearchableSelect from "@/components/SearchableSelect";

export default function EditSchedulePage({ params }) {
    const router = useRouter();
    const { id } = use(params);
    const { user, activeRole } = useAuth();
    const { showSuccess, showError } = useToast();

    const [seasons, setSeasons] = useState([]);
    const [leagues, setLeagues] = useState([]);
    const [locations, setLocations] = useState([]);
    const [teams, setTeams] = useState([]);

    const [seasonId, setSeasonId] = useState("");
    const [leagueId, setLeagueId] = useState("");
    const [locationId, setLocationId] = useState("");
    const [status, setStatus] = useState("Active");

    const [weeks, setWeeks] = useState([
        {
            name: "",
            games: [
                { team1: "", team2: "", field: "", date: "", time: "" }
            ]
        }
    ]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [collapsedWeeks, setCollapsedWeeks] = useState(new Set());

    const toggleWeek = (index) => {
        setCollapsedWeeks(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index); else next.add(index);
            return next;
        });
    };

    const effectiveRole = activeRole || user?.role;
    const canUpdate = hasAnyAccess(user, ["manage_schedules", "schedule_update"]);

    useEffect(() => {
        if (!canUpdate && user) {
            router.push("/admin/schedules");
        }
    }, [canUpdate, user, router]);

    // Fetch initial data
    useEffect(() => {
        if (!id) return;

        Promise.all([
            fetch("/api/seasons").then(r => r.json()),
            fetch("/api/leagues").then(r => r.json()),
            fetch("/api/locations").then(r => r.json()),
            fetch("/api/teams").then(r => r.json()),
            fetch(`/api/schedules/${id}`).then(r => r.json())
        ]).then(([seasonsData, leaguesData, locationsData, teamsData, scheduleData]) => {
            if (seasonsData.success) setSeasons(seasonsData.data);
            if (leaguesData.success) setLeagues(leaguesData.data);
            if (locationsData.success) setLocations(locationsData.data);
            if (teamsData.success) setTeams(teamsData.data);
            
            if (scheduleData.success && scheduleData.data) {
                const schedule = scheduleData.data;
                const schedLeagueId = schedule.leagueId?._id || schedule.leagueId || "";
                setLeagueId(schedLeagueId);
                
                // Auto-select season based on the schedule's league
                if (schedLeagueId && leaguesData.success) {
                    const league = leaguesData.data.find(l => l._id === schedLeagueId);
                    if (league && league.season) {
                        setSeasonId(league.season?._id || league.season);
                    }
                }
                setLocationId(schedule.locationId?._id || schedule.locationId || "");
                setStatus(schedule.status || "Active");

                if (schedule.weeks && schedule.weeks.length > 0) {
                    const parsedWeeks = schedule.weeks.map(w => ({
                        name: w.name || "",
                        games: w.games.map(g => {
                            return {
                                team1: g.team1?._id || g.team1 || "",
                                team2: g.team2?._id || g.team2 || "",
                                field: g.field || "",
                                date: g.date || "",
                                time: g.time || "",
                                gameType: g.gameType || "main",
                                gameRef: g.gameRef || null
                            };
                        })
                    }));
                    setWeeks(parsedWeeks);
                }
            } else {
                showError("Schedule not found");
                router.push("/admin/schedules");
            }
        }).catch(() => {
            showError("Failed to load necessary data");
        }).finally(() => {
            setLoading(false);
        });
    }, [id]);

    const availableLeagues = seasonId
        ? leagues.filter(l => (l.season?._id || l.season) === seasonId)
        : leagues;

    const selectedLeagueData = leagues.find(l => l._id === leagueId);

    const leagueTeams = leagueId
        ? teams.filter(t => (t.league?._id || t.league) === leagueId)
        : teams;

    // Reset league when season changes, but only if the user manually changed the season
    useEffect(() => {
        if (leagueId && selectedLeagueData) {
            const leagueSeason = selectedLeagueData.season?._id || selectedLeagueData.season;
            if (leagueSeason !== seasonId) {
                setLeagueId("");
            }
        }
    }, [seasonId]);

    // Auto-select location based on league
    useEffect(() => {
        if (!loading && selectedLeagueData) {
            const matchingLocation = locations.find(loc => loc.name === selectedLeagueData.location);
            if (matchingLocation) {
                setLocationId(matchingLocation._id);
            }
        }
    }, [leagueId, selectedLeagueData, locations, loading]);

    const selectedLocation = locations.find(l => l._id === locationId);
    const locationFields = selectedLocation?.fields || [];

    const handleAddWeek = () => {
        setWeeks([...weeks, {
            name: "",
            games: [
                { team1: "", team2: "", field: "", date: "", time: "", gameType: "main", gameRef: null }
            ]
        }]);
    };

    const handleRemoveWeek = (weekIndex) => {
        if (!window.confirm("Remove this week and all its games?")) return;
        const newWeeks = [...weeks];
        newWeeks.splice(weekIndex, 1);
        setWeeks(newWeeks);
    };

    const handleDuplicateWeek = (weekIndex) => {
        const source = weeks[weekIndex];
        const copy = {
            name: "",
            games: source.games.map(g => ({ ...g, gameRef: null }))
        };
        const newWeeks = [...weeks];
        newWeeks.splice(weekIndex + 1, 0, copy);
        setWeeks(newWeeks);
    };

    const handleAddGame = (weekIndex) => {
        const newWeeks = [...weeks];
        newWeeks[weekIndex].games.push({ team1: "", team2: "", field: "", date: "", time: "", gameType: "main", gameRef: null });
        setWeeks(newWeeks);
    };

    const handleRemoveGame = (weekIndex, gameIndex) => {
        if (!window.confirm("Remove this game?")) return;
        const newWeeks = [...weeks];
        newWeeks[weekIndex].games.splice(gameIndex, 1);
        setWeeks(newWeeks);
    };

    const handleDuplicateGame = (weekIndex, gameIndex) => {
        const newWeeks = [...weeks];
        const copy = { ...newWeeks[weekIndex].games[gameIndex], gameRef: null };
        newWeeks[weekIndex].games.splice(gameIndex + 1, 0, copy);
        setWeeks(newWeeks);
    };

    const handleSwapTeams = (weekIndex, gameIndex) => {
        const newWeeks = [...weeks];
        const game = newWeeks[weekIndex].games[gameIndex];
        newWeeks[weekIndex].games[gameIndex] = { ...game, team1: game.team2, team2: game.team1 };
        setWeeks(newWeeks);
    };

    const updateWeek = (weekIndex, field, value) => {
        const newWeeks = [...weeks];
        newWeeks[weekIndex][field] = value;
        setWeeks(newWeeks);
    };

    const updateGame = (weekIndex, gameIndex, field, value) => {
        const newWeeks = [...weeks];
        newWeeks[weekIndex].games[gameIndex][field] = value;
        setWeeks(newWeeks);
        const key = `${weekIndex}_${gameIndex}_${field}`;
        if (errors[key]) setErrors(prev => { const next = { ...prev }; delete next[key]; return next; });
    };

    const handleSave = async () => {
        if (!leagueId) {
            showError("Please select a league");
            return;
        }
        if (!locationId) {
            showError("Please select a location");
            return;
        }

        const newErrors = {};
        weeks.forEach((w, wIdx) => {
            w.games.forEach((g, gIdx) => {
                const hasAny = g.team1 || g.team2 || g.date || g.time;
                if (!hasAny) return;
                if (!g.team1) newErrors[`${wIdx}_${gIdx}_team1`] = true;
                if (!g.team2) newErrors[`${wIdx}_${gIdx}_team2`] = true;
                if (!g.date)  newErrors[`${wIdx}_${gIdx}_date`]  = true;
                if (!g.time)  newErrors[`${wIdx}_${gIdx}_time`]  = true;
            });
        });
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            showError("Some games have incomplete data — fill in or clear all fields");
            return;
        }
        setErrors({});

        if (locationFields.length > 0) {
            const missingField = weeks.some(w =>
                w.games.some(g => (g.team1 || g.team2 || g.date || g.time) && !g.field)
            );
            if (missingField && !window.confirm("Some games have no field selected even though fields are available for this location. Save anyway?")) return;
        }

        const selectedLeague = leagues.find(l => l._id === leagueId);
        const selectedLoc = locations.find(l => l._id === locationId);

        const payload = {
            leagueId: leagueId,
            scheduleLabel: selectedLeague?.name || "League Schedule",
            locationId: locationId,
            locationName: selectedLoc?.name || "Selected Location",
            status: status,
            weeks: weeks
                .map((w, index) => ({
                    name: w.name.trim() ? w.name.trim() : `Week ${index + 1}`,
                    games: w.games
                        .filter(g => g.team1 || g.team2 || g.date || g.time)
                        .map(g => ({
                            team1: g.team1 || null,
                            team2: g.team2 || null,
                            field: g.field,
                            date: g.date,
                            time: g.time,
                            gameType: g.gameType || "main",
                            gameRef: g.gameRef || null
                        }))
                }))
                .filter(w => w.games.length > 0)
        };

        setSaving(true);
        try {
            const res = await fetch(`/api/schedules/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                showSuccess("Schedule updated successfully");
                router.push("/admin/schedules");
            } else {
                showError(data.error || "Failed to update schedule");
            }
        } catch (error) {
            showError("Failed to update schedule");
        } finally {
            setSaving(false);
        }
    };

    if (!canUpdate) return null;

    if (loading) {
        return (
            <AdminLayout title="Edit Schedule">
                <div className="admin-loading">
                    <div className="admin-spinner"></div>
                    <div>Loading Schedule...</div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title="Edit Schedule">
            <div className="admin-card" style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32, flexWrap: "wrap", gap: 10 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Edit Schedule</h2>
                    <button 
                        className="admin-btn admin-btn-danger"
                        onClick={() => router.push("/admin/schedules")}
                    >
                        <i className="fa-solid fa-arrow-left" style={{ marginRight: 8 }}></i>
                        Cancel
                    </button>
                </div>

                <div className="schedule-edit-top-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 24, marginBottom: 40 }}>
                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                        <label className="admin-form-label" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#8b90a0" }}>Season</label>
                        <input
                            className="admin-form-input"
                            value={seasons.find(s => s._id === seasonId)?.name || ""}
                            readOnly
                            disabled
                            style={{ padding: "10px 14px", border: "1px solid #e5e7ef", borderRadius: 8, background: "#f3f4f6", color: "#6b7280", cursor: "not-allowed" }}
                        />
                    </div>

                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                        <label className="admin-form-label" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#8b90a0" }}>League</label>
                        <input
                            className="admin-form-input"
                            value={leagues.find(l => l._id === leagueId)?.name || ""}
                            readOnly
                            disabled
                            style={{ padding: "10px 14px", border: "1px solid #e5e7ef", borderRadius: 8, background: "#f3f4f6", color: "#6b7280", cursor: "not-allowed" }}
                        />
                    </div>
                    
                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                        <label className="admin-form-label" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#8b90a0" }}>Location</label>
                        <input 
                            className="admin-form-input" 
                            value={locations.find(l => l._id === locationId)?.name || ""} 
                            readOnly 
                            disabled 
                            placeholder="Auto-populated by league"
                            style={{ padding: "10px 14px", border: "1px solid #e5e7ef", borderRadius: 8, background: "#f3f4f6", color: "#6b7280", cursor: "not-allowed" }}
                        />
                    </div>

                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                        <label className="admin-form-label" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#8b90a0" }}>Status</label>
                        <div 
                            onClick={() => setStatus(status === "Active" ? "Inactive" : "Active")}
                            style={{
                                width: 50,
                                height: 26,
                                borderRadius: 13,
                                background: status === "Active" ? "#22c55e" : "#d1d5db",
                                position: "relative",
                                cursor: "pointer",
                                transition: "all 0.3s ease",
                                marginTop: 8
                            }}
                        >
                            <div style={{
                                width: 22,
                                height: 22,
                                borderRadius: "50%",
                                background: "#fff",
                                position: "absolute",
                                top: 2,
                                left: status === "Active" ? 26 : 2,
                                transition: "all 0.3s ease",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                            }} />
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {weeks.map((week, wIndex) => (
                        <div key={wIndex} style={{ border: "1px solid #e5e7ef", borderRadius: 8 }}>
                            {/* Accordion header */}
                            <div
                                onClick={() => toggleWeek(wIndex)}
                                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: collapsedWeeks.has(wIndex) ? "#f8fafc" : "#fff", cursor: "pointer", userSelect: "none", borderBottom: collapsedWeeks.has(wIndex) ? "none" : "1px solid #e5e7ef" }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 10, color: "#8b90a0", transform: collapsedWeeks.has(wIndex) ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>▼</span>
                                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#1e293b" }}>
                                        {week.name.trim() || `Week ${wIndex + 1}`}
                                        <span style={{ fontSize: 13, fontWeight: 400, color: "#8b90a0", marginLeft: 8 }}>({week.games.length} {week.games.length === 1 ? "game" : "games"})</span>
                                    </h3>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDuplicateWeek(wIndex); }}
                                        style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 14, padding: "0 6px" }}
                                        title="Duplicate Week"
                                    >
                                        <i className="fa-regular fa-copy"></i>
                                    </button>
                                    {weeks.length > 1 && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleRemoveWeek(wIndex); }}
                                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: "0 4px" }}
                                            title="Remove Week"
                                        >
                                            <i className="fa-solid fa-times"></i>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {!collapsedWeeks.has(wIndex) && (
                            <div style={{ padding: 24 }}>
                            <div className="admin-form-group" style={{ marginBottom: 24, marginTop: 0 }}>
                                <label className="admin-form-label" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#8b90a0" }}>Name</label>
                                <input 
                                    className="admin-form-input" 
                                    value={week.name}
                                    placeholder={`Week ${wIndex + 1}`}
                                    onChange={(e) => updateWeek(wIndex, "name", e.target.value)}
                                    style={{ maxWidth: 400 }}
                                />
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                                {week.games.map((game, gIndex) => (
                                    <div key={gIndex} className="schedule-edit-game-row" style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
                                        <button
                                            onClick={() => handleSwapTeams(wIndex, gIndex)}
                                            style={{ background: "none", border: "1px solid #e5e7ef", borderRadius: 6, color: "#6b7280", cursor: "pointer", padding: "0 8px", height: 36, flexShrink: 0 }}
                                            title="Swap Teams"
                                        >
                                            <i className="fa-solid fa-right-left"></i>
                                        </button>
                                        <div className="admin-form-group" style={{ marginBottom: 0, flex: 1 }}>
                                            <label className="admin-form-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: errors[`${wIndex}_${gIndex}_team1`] ? "#FF1E00" : "#8b90a0" }}>Team 1 *</label>
                                            <SearchableSelect
                                                value={game.team1}
                                                onChange={(v) => updateGame(wIndex, gIndex, "team1", v)}
                                                options={leagueTeams.filter(t => t._id !== game.team2).map(t => ({ value: t._id, label: t.name }))}
                                                placeholder="Select Team 1"
                                                error={!!errors[`${wIndex}_${gIndex}_team1`]}
                                            />
                                        </div>
                                        <div className="admin-form-group" style={{ marginBottom: 0, flex: 1 }}>
                                            <label className="admin-form-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: errors[`${wIndex}_${gIndex}_team2`] ? "#FF1E00" : "#8b90a0" }}>Team 2 *</label>
                                            <SearchableSelect
                                                value={game.team2}
                                                onChange={(v) => updateGame(wIndex, gIndex, "team2", v)}
                                                options={leagueTeams.filter(t => t._id !== game.team1).map(t => ({ value: t._id, label: t.name }))}
                                                placeholder="Select Team 2"
                                                error={!!errors[`${wIndex}_${gIndex}_team2`]}
                                            />
                                        </div>
                                        <div className="admin-form-group" style={{ marginBottom: 0, flex: 1 }}>
                                            <label className="admin-form-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#8b90a0" }}>Field</label>
                                            <select
                                                className="admin-form-select"
                                                value={game.field}
                                                onChange={(e) => updateGame(wIndex, gIndex, "field", e.target.value)}
                                            >
                                                <option value="">Select Field</option>
                                                {locationFields.map(f => (
                                                    <option key={f._id} value={f.name}>{f.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                            <label className="admin-form-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: errors[`${wIndex}_${gIndex}_date`] ? "#FF1E00" : "#8b90a0" }}>Date *</label>
                                            <input
                                                type="date"
                                                className="admin-form-input"
                                                value={game.date}
                                                onChange={(e) => updateGame(wIndex, gIndex, "date", e.target.value)}
                                                style={{ width: 160, border: errors[`${wIndex}_${gIndex}_date`] ? "1px solid #FF1E00" : undefined, boxShadow: errors[`${wIndex}_${gIndex}_date`] ? "0 0 0 3px rgba(255,30,0,0.12)" : undefined }}
                                            />
                                        </div>
                                        <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                            <label className="admin-form-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: errors[`${wIndex}_${gIndex}_time`] ? "#FF1E00" : "#8b90a0" }}>Time *</label>
                                                <input
                                                    type="time"
                                                    className="admin-form-input"
                                                    value={game.time}
                                                    onChange={(e) => updateGame(wIndex, gIndex, "time", e.target.value)}
                                                    style={{ width: 140, border: errors[`${wIndex}_${gIndex}_time`] ? "1px solid #FF1E00" : undefined, boxShadow: errors[`${wIndex}_${gIndex}_time`] ? "0 0 0 3px rgba(255,30,0,0.12)" : undefined }}
                                                />
                                        </div>
                                        <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                            <label className="admin-form-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#8b90a0" }}>Type</label>
                                            <select
                                                className="admin-form-select"
                                                value={game.gameType || "main"}
                                                onChange={(e) => updateGame(wIndex, gIndex, "gameType", e.target.value)}
                                                style={{ width: 130 }}
                                            >
                                                <option value="main">Main</option>
                                                <option value="practice">Practice</option>
                                            </select>
                                        </div>
                                        <button
                                            onClick={() => handleDuplicateGame(wIndex, gIndex)}
                                            style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: "10px", height: 42 }}
                                            title="Duplicate Game"
                                        >
                                            <i className="fa-regular fa-copy"></i>
                                        </button>
                                        {week.games.length > 1 && (
                                            <button
                                                onClick={() => handleRemoveGame(wIndex, gIndex)}
                                                style={{ background: "none", border: "none", color: "#FF1E00", cursor: "pointer", padding: "10px", height: 42 }}
                                                title="Remove Game"
                                            >
                                                <i className="fa-solid fa-trash"></i>
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
                                <button
                                    className="admin-btn admin-btn-primary"
                                    style={{ padding: "8px 16px", borderRadius: 6, fontWeight: 600 }}
                                    onClick={() => handleAddGame(wIndex)}
                                >
                                    Add More Schedule
                                </button>
                            </div>
                            </div>
                            )}
                        </div>
                    ))}
                </div>

                <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
                    <button 
                        className="admin-btn admin-btn-primary"
                        style={{ padding: "10px 20px", borderRadius: 6, fontWeight: 600 }}
                        onClick={handleAddWeek}
                    >
                        Add More Week
                    </button>
                </div>

                <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 40 }}>
                    <button 
                        className="admin-btn admin-btn-primary"
                        style={{ padding: "10px 32px", borderRadius: 6, fontWeight: 600, fontSize: 16 }}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                    <button 
                        className="admin-btn admin-btn-danger"
                        style={{ padding: "10px 32px", borderRadius: 6, fontWeight: 600, fontSize: 16 }}
                        onClick={() => router.push("/admin/schedules")}
                    >
                        <i className="fa-solid fa-arrow-left" style={{ marginRight: 8 }}></i>
                        Cancel
                    </button>
                </div>
            </div>
        </AdminLayout>
    );
}
