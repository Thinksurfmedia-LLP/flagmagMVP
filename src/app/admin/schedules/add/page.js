"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminLayout, { hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";
import SearchableSelect from "@/components/SearchableSelect";
import RestrictedDatePicker from "@/components/RestrictedDatePicker";


export default function AddSchedulePage() {
    const router = useRouter();
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
                { team1: "", team2: "", field: "", date: "", time: "", gameType: "main" }
            ]
        }
    ]);

    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [collapsedWeeks, setCollapsedWeeks] = useState(new Set());
    const [orgScheduleDays, setOrgScheduleDays] = useState([]);
    const [dragging, setDragging] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);

    const toggleWeek = (index) => {
        setCollapsedWeeks(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index); else next.add(index);
            return next;
        });
    };

    const effectiveRole = activeRole || user?.role;
    const canCreate = hasAnyAccess(user, ["manage_schedules", "schedule_create"]);

    useEffect(() => {
        if (!canCreate && user) {
            router.push("/admin/schedules");
        }
    }, [canCreate, user, router]);

    // Fetch org schedule days
    useEffect(() => {
        const organizerOrg = user?.roleOrganizations?.[effectiveRole] || user?.organization;
        const slug = organizerOrg?.slug;
        if (!slug) return;
        fetch(`/api/organizations/${slug}`)
            .then(r => r.json())
            .then(d => { if (d.success) setOrgScheduleDays(d.data.scheduleDays || []); })
            .catch(() => {});
    }, [user, effectiveRole]);

    // Fetch initial data
    useEffect(() => {
        Promise.all([
            fetch("/api/seasons").then(r => r.json()),
            fetch("/api/leagues").then(r => r.json()),
            fetch("/api/locations").then(r => r.json()),
            fetch("/api/teams").then(r => r.json())
        ]).then(([seasonsData, leaguesData, locationsData, teamsData]) => {
            if (seasonsData.success) {
                setSeasons(seasonsData.data);
                const defaultSeason = seasonsData.data.find(s => s.isDefault) || seasonsData.data[0];
                if (defaultSeason) setSeasonId(defaultSeason._id);
            }
            if (leaguesData.success) setLeagues(leaguesData.data);
            if (locationsData.success) setLocations(locationsData.data);
            if (teamsData.success) setTeams(teamsData.data);
        }).catch(() => {
            showError("Failed to load necessary data");
        });
    }, []);

    const availableLeagues = seasonId
        ? leagues.filter(l => (l.season?._id || l.season) === seasonId)
        : leagues;

    const selectedLeagueData = leagues.find(l => l._id === leagueId);
    const leagueMinDate = selectedLeagueData?.startDate ? selectedLeagueData.startDate.slice(0, 10) : null;


    const leagueTeams = leagueId
        ? teams.filter(t => t.isPlaceholder || (t.leagues || []).some(m => String(m.league?._id || m.league || "") === leagueId))
        : [];

    // Reset league when season changes
    useEffect(() => {
        setLeagueId("");
    }, [seasonId]);

    // Reset game team selections when league changes
    useEffect(() => {
        setWeeks(prev => prev.map(w => ({
            ...w,
            games: w.games.map(g => ({ ...g, team1: "", team2: "" }))
        })));
    }, [leagueId]);
    
    // Auto-select location based on league
    useEffect(() => {
        if (selectedLeagueData) {
            // Find the location that matches the league's location name
            const matchingLocation = locations.find(loc => loc.name === selectedLeagueData.location);
            if (matchingLocation) {
                setLocationId(matchingLocation._id);
            }
        } else {
            setLocationId("");
        }
    }, [leagueId, selectedLeagueData, locations]);

    const selectedLocation = locations.find(l => l._id === locationId);
    const locationFields = selectedLocation?.fields || [];

    const handleAddWeek = () => {
        setWeeks([...weeks, {
            name: "",
            games: [
                { team1: "", team2: "", field: "", date: "", time: "", gameType: "main" }
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
            games: source.games.map(g => ({ ...g, date: "", time: "" }))
        };
        const newWeeks = [...weeks];
        newWeeks.splice(weekIndex + 1, 0, copy);
        setWeeks(newWeeks);
    };

    const handleAddGame = (weekIndex) => {
        const newWeeks = [...weeks];
        newWeeks[weekIndex].games.push({ team1: "", team2: "", field: "", date: "", time: "", gameType: "main" });
        setWeeks(newWeeks);
    };

    const handleRemoveGame = (weekIndex, gameIndex) => {
        if (!window.confirm("Remove this game?")) return;
        const newWeeks = [...weeks];
        newWeeks[weekIndex].games.splice(gameIndex, 1);
        setWeeks(newWeeks);
        setErrors(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => { if (k.endsWith("_row")) delete next[k]; });
            return next;
        });
    };

    const handleDuplicateGame = (weekIndex, gameIndex) => {
        const newWeeks = [...weeks];
        const copy = { ...newWeeks[weekIndex].games[gameIndex] };
        newWeeks[weekIndex].games.splice(gameIndex + 1, 0, copy);
        setWeeks(newWeeks);
    };

    const handleDrop = (toWeek, toGame) => {
        if (!dragging) return;
        const { weekIndex: fromWeek, gameIndex: fromGame } = dragging;
        if (fromWeek === toWeek && fromGame === toGame) { setDragging(null); setDropTarget(null); return; }
        const newWeeks = weeks.map(w => ({ ...w, games: [...w.games] }));
        const game = { ...newWeeks[fromWeek].games[fromGame] };
        newWeeks[fromWeek].games.splice(fromGame, 1);
        let insertAt = (fromWeek === toWeek && fromGame < toGame) ? toGame - 1 : toGame;
        insertAt = Math.max(0, Math.min(insertAt, newWeeks[toWeek].games.length));
        newWeeks[toWeek].games.splice(insertAt, 0, game);
        setWeeks(newWeeks);
        setDragging(null);
        setDropTarget(null);
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
        setErrors(prev => {
            const next = { ...prev };
            delete next[`${weekIndex}_${gameIndex}_${field}`];
            Object.keys(next).forEach(k => { if (k.endsWith("_row")) delete next[k]; });
            return next;
        });
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

        const hasAnyGame = weeks.some(w => w.games.some(g => g.team1 || g.team2 || g.date || g.time));
        if (!hasAnyGame) {
            setErrors({ "0_0_team1": true, "0_0_team2": true, "0_0_date": true, "0_0_time": true });
            showError("At least one complete game is required to save a schedule");
            return;
        }

        setErrors({});

        if (locationFields.length > 0) {
            const missingField = weeks.some(w =>
                w.games.some(g => (g.team1 || g.team2 || g.date || g.time) && !g.field)
            );
            if (missingField && !window.confirm("Some games have no field selected even though fields are available for this location. Save anyway?")) return;
        }

        // Duplicate game validation
        const completeGames = [];
        weeks.forEach((w, wIdx) => w.games.forEach((g, gIdx) => {
            if (g.team1 && g.team2 && g.date && g.time) completeGames.push({ ...g, wIdx, gIdx });
        }));

        const duplicateRowKeys = new Set();
        let sameDateTimeNoField = false;
        let hasFixtureDuplicate = false;
        let hasFieldConflict = false;
        for (let i = 0; i < completeGames.length; i++) {
            for (let j = i + 1; j < completeGames.length; j++) {
                const a = completeGames[i];
                const b = completeGames[j];
                if (a.date !== b.date || a.time !== b.time) continue;
                const sameFixture =
                    (a.team1 === b.team1 && a.team2 === b.team2) ||
                    (a.team1 === b.team2 && a.team2 === b.team1);
                if (sameFixture) {
                    duplicateRowKeys.add(`${a.wIdx}_${a.gIdx}_row`);
                    duplicateRowKeys.add(`${b.wIdx}_${b.gIdx}_row`);
                    hasFixtureDuplicate = true;
                } else if (locationFields.length > 0) {
                    if (!a.field || !b.field || a.field === b.field) {
                        duplicateRowKeys.add(`${a.wIdx}_${a.gIdx}_row`);
                        duplicateRowKeys.add(`${b.wIdx}_${b.gIdx}_row`);
                        hasFieldConflict = true;
                    }
                } else {
                    sameDateTimeNoField = true;
                }
            }
        }
        if (duplicateRowKeys.size > 0) {
            setErrors(prev => { const next = { ...prev }; duplicateRowKeys.forEach(k => { next[k] = true; }); return next; });
            const reasons = [];
            if (hasFixtureDuplicate) reasons.push("the same matchup is scheduled twice at the same date/time");
            if (hasFieldConflict) reasons.push("two games are booked on the same field at the same date/time");
            showError(`Duplicate games found - ${reasons.join(" and ")}. Check the highlighted rows below.`);
            return;
        }
        if (sameDateTimeNoField && !window.confirm("Some games share the same date and time. This location has no fields to differentiate them. Save anyway?")) return;

        const selectedLeague = leagues.find(l => l._id === leagueId);
        const selectedLoc = locations.find(l => l._id === locationId);

        const payload = {
            leagueId: leagueId,
            scheduleLabel: selectedLeague?.name || "League Schedule",
            locationId: locationId,
            locationName: selectedLoc?.name || "Selected Location",
            status: status,
            organization: selectedLeague?.organization?._id || selectedLeague?.organization || user?.organization?._id || user?.organization,
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
                            gameType: g.gameType || "main"
                        }))
                }))
                .filter(w => w.games.length > 0)
        };

        setSaving(true);
        try {
            const res = await fetch("/api/schedules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (data.success) {
                showSuccess("Schedule created successfully");
                router.push("/admin/schedules");
            } else {
                showError(data.error || "Failed to create schedule");
            }
        } catch (error) {
            showError("Failed to create schedule");
        } finally {
            setSaving(false);
        }
    };

    if (!canCreate) return null;

    return (
        <AdminLayout title="Add Schedule">
            <div className="admin-card" style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Add Schedule</h2>
                    <button 
                        className="admin-btn admin-btn-danger"
                        onClick={() => router.push("/admin/schedules")}
                    >
                        <i className="fa-solid fa-arrow-left" style={{ marginRight: 8 }}></i>
                        Cancel
                    </button>
                </div>

                <div className="schedule-header-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 24, marginBottom: 40 }}>
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

                            <div style={{ display: "flex", flexDirection: "column" }}>
                                {week.games.map((game, gIndex) => {
                                    const isDropHere = dropTarget?.weekIndex === wIndex && dropTarget?.gameIndex === gIndex;
                                    const isDraggingThis = dragging?.weekIndex === wIndex && dragging?.gameIndex === gIndex;
                                    const isDuplicateRow = !!errors[`${wIndex}_${gIndex}_row`];
                                    return (
                                    <div
                                        key={gIndex}
                                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDropTarget({ weekIndex: wIndex, gameIndex: gIndex }); }}
                                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleDrop(wIndex, gIndex); }}
                                        style={{ borderTop: `2px solid ${isDropHere ? "#3b82f6" : "transparent"}`, paddingTop: isDropHere ? 6 : 0, marginBottom: 16, transition: "border-color 0.1s, padding-top 0.1s", background: isDuplicateRow ? "rgba(255,30,0,0.06)" : "transparent", borderRadius: isDuplicateRow ? 8 : 0, outline: isDuplicateRow ? "1.5px solid rgba(255,30,0,0.35)" : "none" }}
                                    >
                                    <div
                                        draggable
                                        onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDragging({ weekIndex: wIndex, gameIndex: gIndex }); }}
                                        onDragEnd={() => { setDragging(null); setDropTarget(null); }}
                                        className="schedule-game-row"
                                        style={{ opacity: isDraggingThis ? 0.3 : 1, transition: "opacity 0.15s" }}
                                    >
                                        <div className="sgr-tl">
                                            <div title="Drag to reorder" className="sgr-drag">⠿</div>
                                            <button
                                                onClick={() => handleSwapTeams(wIndex, gIndex)}
                                                className="sgr-swap-btn"
                                                style={{ background: "none", border: "1px solid #e5e7ef", borderRadius: 6, color: "#6b7280", cursor: "pointer", padding: "0 8px", height: 36 }}
                                                title="Swap Teams"
                                            >
                                                <i className="fa-solid fa-right-left"></i>
                                            </button>
                                        </div>
                                        <div className="sgr-fields">
                                            <div className="admin-form-group sgr-f-team1" style={{ marginBottom: 0 }}>
                                                <label className="admin-form-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: errors[`${wIndex}_${gIndex}_team1`] ? "#FF1E00" : "#8b90a0" }}>Team 1 *</label>
                                                <SearchableSelect
                                                    value={game.team1}
                                                    onChange={(v) => updateGame(wIndex, gIndex, "team1", v)}
                                                    options={leagueTeams.filter(t => String(t._id) !== game.team2).map(t => ({ value: String(t._id), label: t.name }))}
                                                    placeholder="Select Team 1"
                                                    error={!!errors[`${wIndex}_${gIndex}_team1`]}
                                                />
                                            </div>
                                            <div className="admin-form-group sgr-f-team2" style={{ marginBottom: 0 }}>
                                                <label className="admin-form-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: errors[`${wIndex}_${gIndex}_team2`] ? "#FF1E00" : "#8b90a0" }}>Team 2 *</label>
                                                <SearchableSelect
                                                    value={game.team2}
                                                    onChange={(v) => updateGame(wIndex, gIndex, "team2", v)}
                                                    options={leagueTeams.filter(t => String(t._id) !== game.team1).map(t => ({ value: String(t._id), label: t.name }))}
                                                    placeholder="Select Team 2"
                                                    error={!!errors[`${wIndex}_${gIndex}_team2`]}
                                                />
                                            </div>
                                            <div className="admin-form-group sgr-f-field" style={{ marginBottom: 0 }}>
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
                                            <div className="admin-form-group sgr-f-date" style={{ marginBottom: 0 }}>
                                                <label className="admin-form-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: errors[`${wIndex}_${gIndex}_date`] ? "#FF1E00" : "#8b90a0" }}>Date *</label>
                                                <RestrictedDatePicker
                                                    value={game.date}
                                                    onChange={(v) => updateGame(wIndex, gIndex, "date", v)}
                                                    scheduleDays={orgScheduleDays}
                                                    minDate={leagueMinDate}
                                                    error={!!errors[`${wIndex}_${gIndex}_date`]}
                                                />
                                            </div>
                                            <div className="admin-form-group sgr-f-time" style={{ marginBottom: 0 }}>
                                                <label className="admin-form-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: errors[`${wIndex}_${gIndex}_time`] ? "#FF1E00" : "#8b90a0" }}>Time *</label>
                                                <input
                                                    type="time"
                                                    className="admin-form-input"
                                                    value={game.time}
                                                    onChange={(e) => updateGame(wIndex, gIndex, "time", e.target.value)}
                                                    style={{ border: errors[`${wIndex}_${gIndex}_time`] ? "1px solid #FF1E00" : undefined, boxShadow: errors[`${wIndex}_${gIndex}_time`] ? "0 0 0 3px rgba(255,30,0,0.12)" : undefined }}
                                                />
                                            </div>
                                            <div className="admin-form-group sgr-f-type" style={{ marginBottom: 0 }}>
                                                <label className="admin-form-label" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#8b90a0" }}>Type</label>
                                                <select
                                                    className="admin-form-select"
                                                    value={game.gameType || "main"}
                                                    onChange={(e) => updateGame(wIndex, gIndex, "gameType", e.target.value)}
                                                >
                                                    <option value="main">Main</option>
                                                    <option value="practice">Practice</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div className="sgr-tr">
                                            <button
                                                onClick={() => handleDuplicateGame(wIndex, gIndex)}
                                                style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: "8px", height: 36 }}
                                                title="Duplicate Game"
                                            >
                                                <i className="fa-regular fa-copy"></i>
                                            </button>
                                            {week.games.length > 1 && (
                                                <button
                                                    onClick={() => handleRemoveGame(wIndex, gIndex)}
                                                    style={{ background: "none", border: "none", color: "#FF1E00", cursor: "pointer", padding: "8px", height: 36 }}
                                                    title="Remove Game"
                                                >
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    </div>
                                );
                                })}
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setDropTarget({ weekIndex: wIndex, gameIndex: week.games.length }); }}
                                    onDrop={(e) => { e.preventDefault(); handleDrop(wIndex, week.games.length); }}
                                    style={{ height: dropTarget?.weekIndex === wIndex && dropTarget?.gameIndex === week.games.length ? 32 : 10, borderRadius: 4, background: dropTarget?.weekIndex === wIndex && dropTarget?.gameIndex === week.games.length ? "rgba(59,130,246,0.08)" : "transparent", border: `2px dashed ${dropTarget?.weekIndex === wIndex && dropTarget?.gameIndex === week.games.length ? "#3b82f6" : "transparent"}`, transition: "height 0.15s, background 0.15s" }}
                                />
                            </div>

                            <div style={{ display: "flex", justifyContent: "flex-start", marginTop: 20, paddingLeft: 4 }}>
                                <button
                                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 6, fontWeight: 600, fontSize: 13, background: "transparent", border: "1.5px dashed #d1d5db", color: "#374151", cursor: "pointer" }}
                                    onClick={() => handleAddGame(wIndex)}
                                >
                                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Game to This Week
                                </button>
                            </div>
                            </div>
                            )}
                        </div>
                    ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 28, marginBottom: 4 }}>
                    <div style={{ flex: 1, height: 1, background: "#e5e7ef" }} />
                    <button
                        className="admin-btn admin-btn-primary"
                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 22px", borderRadius: 6, fontWeight: 700, fontSize: 14, whiteSpace: "nowrap" }}
                        onClick={handleAddWeek}
                    >
                        <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> Add New Week
                    </button>
                    <div style={{ flex: 1, height: 1, background: "#e5e7ef" }} />
                </div>

                <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 40 }}>
                    <button 
                        className="admin-btn admin-btn-primary"
                        style={{ padding: "10px 32px", borderRadius: 6, fontWeight: 600, fontSize: 16 }}
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Save"}
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
