"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import AdminLayout, { hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

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

    // Reset league when season changes, but only if the user manually changed the season
    // Since we fetch and set seasonId initially, we don't want to clear the leagueId then.
    // A simple way is to check if leagueId's season matches seasonId
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
        const newWeeks = [...weeks];
        newWeeks.splice(weekIndex, 1);
        setWeeks(newWeeks);
    };

    const handleAddGame = (weekIndex) => {
        const newWeeks = [...weeks];
        newWeeks[weekIndex].games.push({ team1: "", team2: "", field: "", date: "", time: "", gameType: "main", gameRef: null });
        setWeeks(newWeeks);
    };

    const handleRemoveGame = (weekIndex, gameIndex) => {
        const newWeeks = [...weeks];
        newWeeks[weekIndex].games.splice(gameIndex, 1);
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

        const selectedLeague = leagues.find(l => l._id === leagueId);
        const selectedLoc = locations.find(l => l._id === locationId);

        const payload = {
            leagueId: leagueId,
            scheduleLabel: selectedLeague?.name || "League Schedule",
            locationId: locationId,
            locationName: selectedLoc?.name || "Selected Location",
            status: status,
            weeks: weeks.map((w, index) => ({
                name: w.name.trim() ? w.name.trim() : `Week ${index + 1}`,
                games: w.games.map(g => ({
                    team1: g.team1 || null,
                    team2: g.team2 || null,
                    field: g.field,
                    date: g.date,
                    time: g.time,
                    gameType: g.gameType || "main",
                    gameRef: g.gameRef || null
                }))
            }))
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Edit Schedule</h2>
                    <button 
                        className="admin-btn admin-btn-danger"
                        onClick={() => router.push("/admin/schedules")}
                    >
                        <i className="fa-solid fa-arrow-left" style={{ marginRight: 8 }}></i>
                        Cancel
                    </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 24, marginBottom: 40 }}>
                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                        <label className="admin-form-label" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#8b90a0" }}>Season</label>
                        <select 
                            className="admin-form-select" 
                            value={seasonId} 
                            onChange={(e) => setSeasonId(e.target.value)}
                            style={{ padding: "10px 14px", border: "1px solid #e5e7ef", borderRadius: 8 }}
                        >
                            <option value="">Select Season</option>
                            {seasons.map(s => (
                                <option key={s._id} value={s._id}>{s.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="admin-form-group" style={{ marginBottom: 0 }}>
                        <label className="admin-form-label" style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#8b90a0" }}>League</label>
                        <select 
                            className="admin-form-select" 
                            value={leagueId} 
                            onChange={(e) => setLeagueId(e.target.value)}
                            disabled={!seasonId}
                            style={{ padding: "10px 14px", border: "1px solid #e5e7ef", borderRadius: 8 }}
                        >
                            <option value="">Select League</option>
                            {availableLeagues.map(l => (
                                <option key={l._id} value={l._id}>{l.name}</option>
                            ))}
                        </select>
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

                <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                    {weeks.map((week, wIndex) => (
                        <div key={wIndex} style={{ border: "1px solid #e5e7ef", borderRadius: 8, padding: 24, position: "relative" }}>
                            <div style={{ position: "absolute", top: -14, left: 24, background: "#fff", padding: "0 8px" }}>
                                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#1e293b" }}>Week {wIndex + 1}</h3>
                            </div>
                            
                            {weeks.length > 1 && (
                                <button 
                                    onClick={() => handleRemoveWeek(wIndex)}
                                    style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 18 }}
                                    title="Remove Week"
                                >
                                    <i className="fa-solid fa-times"></i>
                                </button>
                            )}

                            <div className="admin-form-group" style={{ marginBottom: 24, marginTop: 8 }}>
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
                                    <div key={gIndex} style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
                                        <div className="admin-form-group" style={{ marginBottom: 0, flex: 1 }}>
                                            <label className="admin-form-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#8b90a0" }}>Team 1</label>
                                            <select 
                                                className="admin-form-select" 
                                                value={game.team1}
                                                onChange={(e) => updateGame(wIndex, gIndex, "team1", e.target.value)}
                                            >
                                                <option value="">Select Team 1</option>
                                                {teams.map(t => (
                                                    <option key={t._id} value={t._id}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="admin-form-group" style={{ marginBottom: 0, flex: 1 }}>
                                            <label className="admin-form-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#8b90a0" }}>Team 2</label>
                                            <select 
                                                className="admin-form-select" 
                                                value={game.team2}
                                                onChange={(e) => updateGame(wIndex, gIndex, "team2", e.target.value)}
                                            >
                                                <option value="">Select Team 2</option>
                                                {teams.map(t => (
                                                    <option key={t._id} value={t._id}>{t.name}</option>
                                                ))}
                                            </select>
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
                                            <label className="admin-form-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#8b90a0" }}>Date</label>
                                            <input 
                                                type="date"
                                                className="admin-form-input" 
                                                value={game.date}
                                                onChange={(e) => updateGame(wIndex, gIndex, "date", e.target.value)}
                                                style={{ width: 160 }}
                                            />
                                        </div>
                                        <div className="admin-form-group" style={{ marginBottom: 0 }}>
                                            <label className="admin-form-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#8b90a0" }}>Time</label>
                                                <input 
                                                    type="time"
                                                    className="admin-form-input" 
                                                    value={game.time}
                                                    onChange={(e) => updateGame(wIndex, gIndex, "time", e.target.value)}
                                                    style={{ width: 140 }}
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
