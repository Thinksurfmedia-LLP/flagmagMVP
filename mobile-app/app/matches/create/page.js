"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "../../lib/AuthContext";
import { apiGet, apiPost } from "../../lib/api";

function CreateMatchContent() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [leagues, setLeagues] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [form, setForm] = useState({
        teamA: "",
        teamB: "",
        location: "",
        date: "",
        time: "",
        league: "",
        referee: "",
        notes: "",
    });

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [authLoading, user, router]);

    // Fetch leagues and teams
    useEffect(() => {
        const orgSlug =
            user?.organization?.slug ||
            Object.values(user?.roleOrganizations || {}).find((o) => o?.slug)?.slug;
        if (!orgSlug) return;
        apiGet(`/api/organizations/${orgSlug}/leagues`)
            .then((res) => setLeagues(res.data || []))
            .catch(() => {});
        apiGet(`/api/organizations/${orgSlug}/teams`)
            .then((res) => setTeams(res.data || []))
            .catch(() => {});
    }, [user]);

    const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!form.teamA || !form.teamB || !form.date || !form.league) {
            setError("Please fill in all required fields (Teams, Date, League)");
            return;
        }
        if (form.teamA === form.teamB) {
            setError("Team 1 and Team 2 must be different");
            return;
        }

        setLoading(true);
        try {
            // Find team names
            const teamAObj = teams.find((t) => t._id === form.teamA);
            const teamBObj = teams.find((t) => t._id === form.teamB);

            await apiPost(`/api/seasons/${form.league}/games`, {
                teamA: {
                    name: teamAObj?.name || form.teamA,
                    logo: teamAObj?.logo || "",
                },
                teamB: {
                    name: teamBObj?.name || form.teamB,
                    logo: teamBObj?.logo || "",
                },
                date: form.date,
                time: form.time,
                location: form.location,
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
                            <span>Create Match</span>
                        </div>
                    </header>

                    {error && <div className="toast-message error">{error}</div>}

                    <form className="create-match-area" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Team 1 *</label>
                            <select
                                className="form-control select-form-control"
                                value={form.teamA}
                                onChange={update("teamA")}
                                required
                            >
                                <option value="">Select Team 1</option>
                                {teams.map((t) => (
                                    <option key={t._id} value={t._id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Team 2 *</label>
                            <select
                                className="form-control select-form-control"
                                value={form.teamB}
                                onChange={update("teamB")}
                                required
                            >
                                <option value="">Select Team 2</option>
                                {teams.map((t) => (
                                    <option key={t._id} value={t._id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Location</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Enter location..."
                                value={form.location}
                                onChange={update("location")}
                            />
                        </div>
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
                        <div className="form-group">
                            <label>Tournament / League *</label>
                            <select
                                className="form-control select-form-control"
                                value={form.league}
                                onChange={update("league")}
                                required
                            >
                                <option value="">Select League</option>
                                {leagues.map((l) => (
                                    <option key={l._id} value={l._id}>
                                        {l.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Referee</label>
                            <input
                                type="text"
                                className="form-control"
                                placeholder="Referee name..."
                                value={form.referee}
                                onChange={update("referee")}
                            />
                        </div>
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
                            {loading ? "Creating..." : "Create Match"}
                        </button>

                        <h6 style={{ textAlign: "center", marginTop: 15 }}>
                            <a
                                href="#"
                                onClick={(e) => {
                                    e.preventDefault();
                                    router.back();
                                }}
                                style={{ color: "#ff1e00" }}
                            >
                                Cancel
                            </a>
                        </h6>
                    </form>
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
