"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "../../lib/AuthContext";
import { apiGet, apiPost } from "../../lib/api";

function CreateMatchContent() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const [seasons, setSeasons] = useState([]);
    const [allLeagues, setAllLeagues] = useState([]);
    const [allTeams, setAllTeams] = useState([]);
    const [selectedSeason, setSelectedSeason] = useState("");
    const [selectedLeague, setSelectedLeague] = useState("");
    const [form, setForm] = useState({
        teamA: "",
        teamB: "",
        location: "",
        date: "",
        time: "",
        notes: "",
    });
    const [venueDetails, setVenueDetails] = useState({}); // venueName -> fields[]
    const [selectedField, setSelectedField] = useState("");
    const [loading, setLoading] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!authLoading && !user) router.push("/login");
    }, [authLoading, user, router]);

    // Fetch seasons + leagues + teams when user is available
    useEffect(() => {
        const orgSlug =
            user?.organization?.slug ||
            Object.values(user?.roleOrganizations || {}).find((o) => o?.slug)?.slug;
        if (!orgSlug) return;

        setDataLoading(true);
        let remaining = 3;
        const done = () => { if (--remaining === 0) setDataLoading(false); };

        apiGet(`/api/organizations/${orgSlug}/seasons`)
            .then((res) => {
                const fetched = res.data || [];
                setSeasons(fetched);
                const def = fetched.find((s) => s.isDefault) || fetched[0];
                if (def) setSelectedSeason(def._id);
            })
            .catch(() => {})
            .finally(done);

        apiGet(`/api/organizations/${orgSlug}/leagues`)
            .then((res) => setAllLeagues(res.data || []))
            .catch(() => {})
            .finally(done);

        apiGet(`/api/teams`)
            .then((res) => setAllTeams(res.data || []))
            .catch(() => {})
            .finally(done);
    }, [user]);

    // Leagues filtered by selected season
    const filteredLeagues = useMemo(
        () => allLeagues.filter((l) => l.season?._id === selectedSeason || String(l.season?._id || l.season) === selectedSeason),
        [allLeagues, selectedSeason]
    );

    // Auto-select first league when season changes
    useEffect(() => {
        if (filteredLeagues.length > 0) {
            setSelectedLeague(filteredLeagues[0]._id);
        } else {
            setSelectedLeague("");
        }
        setForm((f) => ({ ...f, teamA: "", teamB: "", location: "" }));
    }, [selectedSeason, filteredLeagues]);

    // Teams filtered by selected league
    const filteredTeams = useMemo(
        () => allTeams.filter((t) => String(t.league?._id || t.league) === selectedLeague),
        [allTeams, selectedLeague]
    );

    // Locations from the selected league
    const leagueObj = useMemo(
        () => allLeagues.find((l) => l._id === selectedLeague),
        [allLeagues, selectedLeague]
    );
    const locations = leagueObj?.locations || [];

    // Reset team + location selections when league changes
    useEffect(() => {
        setForm((f) => ({ ...f, teamA: "", teamB: "", location: "" }));
        setSelectedField("");
        setVenueDetails({});
    }, [selectedLeague]);

    // Fetch venue field details whenever league's locations change
    useEffect(() => {
        if (locations.length === 0) return;
        const names = locations.join(",");
        apiGet(`/api/locations/search?names=${encodeURIComponent(names)}`)
            .then((res) => {
                const map = {};
                (res.data || []).forEach((v) => { map[v.name] = v.fields || []; });
                setVenueDetails(map);
            })
            .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLeague]);

    const update = (field) => (e) => {
        if (field === "location") setSelectedField("");
        setForm((f) => ({ ...f, [field]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!selectedLeague) { setError("Please select a league"); return; }
        if (!form.teamA || !form.teamB) { setError("Please select both teams"); return; }
        if (form.teamA === form.teamB) { setError("Team 1 and Team 2 must be different"); return; }
        if (!form.date) { setError("Please select a date"); return; }

        const teamAObj = filteredTeams.find((t) => t._id === form.teamA);
        const teamBObj = filteredTeams.find((t) => t._id === form.teamB);

        setLoading(true);
        try {
            const venueName = form.location;
            const fieldName = selectedField;
            const fullLocation = venueName && fieldName ? `${venueName} - ${fieldName}` : venueName;

            await apiPost(`/api/seasons/${selectedLeague}/games`, {
                teamA: { name: teamAObj?.name || form.teamA, logo: teamAObj?.logo || "" },
                teamB: { name: teamBObj?.name || form.teamB, logo: teamBObj?.logo || "" },
                date: form.date,
                time: form.time,
                location: fullLocation,
                status: "upcoming",
            });
            router.push("/matches");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div className="wrapper">
                <div className="main-section-wrapper">
                    <div className="loading-spinner" />
                </div>
            </div>
        );
    }

    return (
        <div className="wrapper">
            <div className="main-section-wrapper login2" style={{ alignItems: "flex-start" }}>
                <div className="content-wrapper" style={{ alignItems: "flex-start" }}>
                    <header>
                        <div className="back-btn-area">
                            <button onClick={() => router.back()}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 12H5M12 19l-7-7 7-7" />
                                </svg>
                            </button>
                            <span>Create Game</span>
                        </div>
                    </header>

                    {error && <div className="toast-message error">{error}</div>}

                    {dataLoading ? (
                        <div className="loading-spinner" style={{ marginTop: 40 }} />
                    ) : (
                    <form className="create-match-area" onSubmit={handleSubmit}>

                        {/* Season */}
                        <div className="form-group">
                            <label>Season *</label>
                            <select
                                className="form-control select-form-control"
                                value={selectedSeason}
                                onChange={(e) => setSelectedSeason(e.target.value)}
                                required
                            >
                                <option value="">Select Season</option>
                                {seasons.map((s) => (
                                    <option key={s._id} value={s._id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* League */}
                        <div className="form-group">
                            <label>League *</label>
                            <select
                                className="form-control select-form-control"
                                value={selectedLeague}
                                onChange={(e) => setSelectedLeague(e.target.value)}
                                required
                                disabled={!selectedSeason || filteredLeagues.length === 0}
                            >
                                <option value="">
                                    {!selectedSeason ? "Select a season first" : filteredLeagues.length === 0 ? "No leagues for this season" : "Select League"}
                                </option>
                                {filteredLeagues.map((l) => (
                                    <option key={l._id} value={l._id}>{l.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Team A */}
                        <div className="form-group">
                            <label>Team 1 *</label>
                            <select
                                className="form-control select-form-control"
                                value={form.teamA}
                                onChange={update("teamA")}
                                required
                                disabled={!selectedLeague || filteredTeams.length === 0}
                            >
                                <option value="">
                                    {!selectedLeague ? "Select a league first" : filteredTeams.length === 0 ? "No teams in this league" : "Select Team 1"}
                                </option>
                                {filteredTeams.map((t) => (
                                    <option key={t._id} value={t._id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Team B */}
                        <div className="form-group">
                            <label>Team 2 *</label>
                            <select
                                className="form-control select-form-control"
                                value={form.teamB}
                                onChange={update("teamB")}
                                required
                                disabled={!selectedLeague || filteredTeams.length === 0}
                            >
                                <option value="">
                                    {!selectedLeague ? "Select a league first" : filteredTeams.length === 0 ? "No teams in this league" : "Select Team 2"}
                                </option>
                                {filteredTeams
                                    .filter((t) => t._id !== form.teamA)
                                    .map((t) => (
                                        <option key={t._id} value={t._id}>{t.name}</option>
                                    ))}
                            </select>
                        </div>

                        {/* Location */}
                        <div className="form-group">
                            <label>Venue / Location</label>
                            {locations.length > 0 ? (
                                <select
                                    className="form-control select-form-control"
                                    value={form.location}
                                    onChange={update("location")}
                                >
                                    <option value="">Select Venue</option>
                                    {locations.map((loc) => (
                                        <option key={loc} value={loc}>{loc}</option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type="text"
                                    className="form-control"
                                    placeholder="Enter location..."
                                    value={form.location}
                                    onChange={update("location")}
                                />
                            )}
                        </div>

                        {/* Field — only shown when the selected venue has fields */}
                        {form.location && venueDetails[form.location]?.length > 0 && (
                            <div className="form-group">
                                <label>Field</label>
                                <select
                                    className="form-control select-form-control"
                                    value={selectedField}
                                    onChange={(e) => setSelectedField(e.target.value)}
                                >
                                    <option value="">Select Field</option>
                                    {venueDetails[form.location].map((f) => (
                                        <option key={f._id} value={f.name}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Date & Time */}
                        <div className="row">
                            <div>
                                <div className="form-group">
                                    <label>Date *</label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={form.date}
                                        onChange={update("date")}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="form-group">
                                    <label>Time</label>
                                    <input
                                        type="time"
                                        className="form-control"
                                        value={form.time}
                                        onChange={update("time")}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Referee — read-only, pre-filled with logged-in user name */}
                        <div className="form-group">
                            <label>Referee</label>
                            <input
                                type="text"
                                className="form-control"
                                value={user?.name || user?.email || ""}
                                readOnly
                                style={{ opacity: 0.6, cursor: "not-allowed" }}
                            />
                        </div>

                        {/* Notes */}
                        <div className="form-group">
                            <label>Notes</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Add any notes..."
                                value={form.notes}
                                onChange={update("notes")}
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary w-100"
                            disabled={loading}
                        >
                            {loading ? "Creating..." : "Create Game"}
                        </button>

                        <h6 style={{ textAlign: "center", marginTop: 15 }}>
                            <a
                                href="#"
                                onClick={(e) => { e.preventDefault(); router.back(); }}
                                style={{ color: "#ff1e00" }}
                            >
                                Cancel
                            </a>
                        </h6>
                    </form>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function CreateMatchPage() {
    return (
        <AuthProvider>
            <CreateMatchContent />
        </AuthProvider>
    );
}
