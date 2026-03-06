"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/components/AuthProvider";

function AdminSection({ title, children, onAdd, addLabel }) {
    return (
        <div className="admin-section mb-5">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h3 className="mb-0">{title}</h3>
                {onAdd && (
                    <button className="btn btn-primary btn-sm" onClick={onAdd}>
                        + {addLabel || "Add New"}
                    </button>
                )}
            </div>
            {children}
        </div>
    );
}

function OrgForm({ org, onSave, onCancel }) {
    const [form, setForm] = useState(
        org || {
            name: "",
            slug: "",
            description: "",
            location: "",
            sport: "Flag Football",
            rating: 0,
            memberCount: 0,
            foundedYear: new Date().getFullYear(),
            tags: [],
            scheduleDays: [],
        }
    );
    const [tagInput, setTagInput] = useState(org?.tags?.join(", ") || "");
    const [daysInput, setDaysInput] = useState(org?.scheduleDays?.join(", ") || "");

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...form,
            tags: tagInput.split(",").map((t) => t.trim()).filter(Boolean),
            scheduleDays: daysInput.split(",").map((d) => d.trim().toUpperCase()).filter(Boolean),
        });
    };

    return (
        <form onSubmit={handleSubmit} className="p-3 mb-3" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
            <div className="row g-3">
                <div className="col-md-6">
                    <label className="form-label">Name *</label>
                    <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="col-md-6">
                    <label className="form-label">Sport</label>
                    <select className="form-control" value={form.sport} onChange={(e) => setForm({ ...form, sport: e.target.value })}>
                        <option>Flag Football</option>
                        <option>Basketball</option>
                        <option>Soccer</option>
                        <option>Pickleball</option>
                        <option>Other</option>
                    </select>
                </div>
                <div className="col-md-6">
                    <label className="form-label">Location</label>
                    <input className="form-control" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
                <div className="col-md-3">
                    <label className="form-label">Founded Year</label>
                    <input type="number" className="form-control" value={form.foundedYear} onChange={(e) => setForm({ ...form, foundedYear: +e.target.value })} />
                </div>
                <div className="col-md-3">
                    <label className="form-label">Rating</label>
                    <input type="number" step="0.1" min="0" max="5" className="form-control" value={form.rating} onChange={(e) => setForm({ ...form, rating: +e.target.value })} />
                </div>
                <div className="col-12">
                    <label className="form-label">Description</label>
                    <textarea className="form-control" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div className="col-md-6">
                    <label className="form-label">Tags (comma-separated)</label>
                    <input className="form-control" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Coed, Men's, Youth" />
                </div>
                <div className="col-md-6">
                    <label className="form-label">Schedule Days (comma-separated)</label>
                    <input className="form-control" value={daysInput} onChange={(e) => setDaysInput(e.target.value)} placeholder="MON, WED, SAT" />
                </div>
            </div>
            <div className="mt-3">
                <button type="submit" className="btn btn-primary btn-sm me-2">Save</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
            </div>
        </form>
    );
}

function SeasonForm({ season, orgSlug, onSave, onCancel }) {
    const [form, setForm] = useState(
        season || { name: "", type: "active", category: "coed", location: "", time: "" }
    );

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(form);
    };

    return (
        <form onSubmit={handleSubmit} className="p-3 mb-3" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
            <div className="row g-3">
                <div className="col-md-4">
                    <label className="form-label">Season Name *</label>
                    <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="col-md-2">
                    <label className="form-label">Type</label>
                    <select className="form-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                        <option value="active">Active</option>
                        <option value="past">Past</option>
                    </select>
                </div>
                <div className="col-md-2">
                    <label className="form-label">Category</label>
                    <select className="form-control" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                        <option value="coed">Coed</option>
                        <option value="men">Men</option>
                        <option value="women">Women</option>
                        <option value="youth">Youth</option>
                    </select>
                </div>
                <div className="col-md-2">
                    <label className="form-label">Location</label>
                    <input className="form-control" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
                <div className="col-md-2">
                    <label className="form-label">Time</label>
                    <input className="form-control" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} placeholder="5:00 PM" />
                </div>
            </div>
            <div className="mt-3">
                <button type="submit" className="btn btn-primary btn-sm me-2">Save</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
            </div>
        </form>
    );
}

function GameForm({ game, onSave, onCancel }) {
    const [form, setForm] = useState(
        game || {
            date: "",
            time: "",
            teamA: { name: "", score: null },
            teamB: { name: "", score: null },
            location: "",
            status: "upcoming",
        }
    );

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(form);
    };

    return (
        <form onSubmit={handleSubmit} className="p-3 mb-3" style={{ background: "rgba(255,255,255,0.05)", borderRadius: 8 }}>
            <div className="row g-3">
                <div className="col-md-3">
                    <label className="form-label">Date *</label>
                    <input type="date" className="form-control" value={form.date ? form.date.substring(0, 10) : ""} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                </div>
                <div className="col-md-2">
                    <label className="form-label">Time</label>
                    <input className="form-control" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} placeholder="17:00" />
                </div>
                <div className="col-md-2">
                    <label className="form-label">Team A *</label>
                    <input className="form-control" value={form.teamA.name} onChange={(e) => setForm({ ...form, teamA: { ...form.teamA, name: e.target.value } })} required />
                </div>
                <div className="col-md-2">
                    <label className="form-label">Team B *</label>
                    <input className="form-control" value={form.teamB.name} onChange={(e) => setForm({ ...form, teamB: { ...form.teamB, name: e.target.value } })} required />
                </div>
                <div className="col-md-3">
                    <label className="form-label">Location</label>
                    <input className="form-control" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
                <div className="col-md-2">
                    <label className="form-label">Status</label>
                    <select className="form-control" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                        <option value="upcoming">Upcoming</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>
                {form.status === "completed" && (
                    <>
                        <div className="col-md-2">
                            <label className="form-label">Score A</label>
                            <input type="number" className="form-control" value={form.teamA.score || ""} onChange={(e) => setForm({ ...form, teamA: { ...form.teamA, score: +e.target.value } })} />
                        </div>
                        <div className="col-md-2">
                            <label className="form-label">Score B</label>
                            <input type="number" className="form-control" value={form.teamB.score || ""} onChange={(e) => setForm({ ...form, teamB: { ...form.teamB, score: +e.target.value } })} />
                        </div>
                    </>
                )}
            </div>
            <div className="mt-3">
                <button type="submit" className="btn btn-primary btn-sm me-2">Save</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Cancel</button>
            </div>
        </form>
    );
}

export default function AdminDashboard() {
    const { user, loading: authLoading } = useAuth();
    const [orgs, setOrgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Form states
    const [showOrgForm, setShowOrgForm] = useState(false);
    const [editOrg, setEditOrg] = useState(null);
    const [expandedOrg, setExpandedOrg] = useState(null);
    const [orgSeasons, setOrgSeasons] = useState({});
    const [showSeasonForm, setShowSeasonForm] = useState(null);
    const [editSeason, setEditSeason] = useState(null);
    const [expandedSeason, setExpandedSeason] = useState(null);
    const [seasonGames, setSeasonGames] = useState({});
    const [showGameForm, setShowGameForm] = useState(null);
    const [editGame, setEditGame] = useState(null);

    const fetchOrgs = useCallback(async () => {
        try {
            const res = await fetch("/api/organizations");
            const data = await res.json();
            if (data.success) setOrgs(data.data);
        } catch (err) {
            setError("Failed to load organizations");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOrgs();
    }, [fetchOrgs]);

    const flash = (msg) => {
        setSuccess(msg);
        setTimeout(() => setSuccess(""), 3000);
    };

    // ── Organization CRUD ──
    const saveOrg = async (formData) => {
        setError("");
        const isEdit = !!editOrg;
        const url = isEdit ? `/api/organizations/${editOrg.slug}` : "/api/organizations";
        const method = isEdit ? "PUT" : "POST";

        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
        const data = await res.json();
        if (!data.success) { setError(data.error); return; }

        setShowOrgForm(false);
        setEditOrg(null);
        fetchOrgs();
        flash(isEdit ? "Organization updated!" : "Organization created!");
    };

    const deleteOrg = async (slug) => {
        if (!confirm("Delete this organization? This cannot be undone.")) return;
        const res = await fetch(`/api/organizations/${slug}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) { setError(data.error); return; }
        fetchOrgs();
        flash("Organization deleted!");
    };

    // ── Season CRUD ──
    const fetchSeasons = async (slug) => {
        const res = await fetch(`/api/organizations/${slug}/seasons`);
        const data = await res.json();
        if (data.success) setOrgSeasons((prev) => ({ ...prev, [slug]: data.data }));
    };

    const toggleOrg = (slug) => {
        if (expandedOrg === slug) {
            setExpandedOrg(null);
        } else {
            setExpandedOrg(slug);
            if (!orgSeasons[slug]) fetchSeasons(slug);
        }
    };

    const saveSeason = async (formData, orgSlug) => {
        setError("");
        const isEdit = !!editSeason;
        const url = isEdit ? `/api/seasons/${editSeason._id}` : `/api/organizations/${orgSlug}/seasons`;
        const method = isEdit ? "PUT" : "POST";

        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
        const data = await res.json();
        if (!data.success) { setError(data.error); return; }

        setShowSeasonForm(null);
        setEditSeason(null);
        fetchSeasons(orgSlug);
        flash(isEdit ? "Season updated!" : "Season created!");
    };

    const deleteSeason = async (seasonId, orgSlug) => {
        if (!confirm("Delete this season?")) return;
        const res = await fetch(`/api/seasons/${seasonId}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) { setError(data.error); return; }
        fetchSeasons(orgSlug);
        flash("Season deleted!");
    };

    // ── Game CRUD ──
    const fetchGames = async (seasonId) => {
        const res = await fetch(`/api/seasons/${seasonId}/games`);
        const data = await res.json();
        if (data.success) setSeasonGames((prev) => ({ ...prev, [seasonId]: data.data }));
    };

    const toggleSeason = (seasonId) => {
        if (expandedSeason === seasonId) {
            setExpandedSeason(null);
        } else {
            setExpandedSeason(seasonId);
            if (!seasonGames[seasonId]) fetchGames(seasonId);
        }
    };

    const saveGame = async (formData, seasonId, orgSlug) => {
        setError("");
        const isEdit = !!editGame;
        const url = isEdit ? `/api/games/${editGame._id}` : `/api/seasons/${seasonId}/games`;
        const method = isEdit ? "PUT" : "POST";

        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
        const data = await res.json();
        if (!data.success) { setError(data.error); return; }

        setShowGameForm(null);
        setEditGame(null);
        fetchGames(seasonId);
        flash(isEdit ? "Game updated!" : "Game created!");
    };

    const deleteGame = async (gameId, seasonId) => {
        if (!confirm("Delete this game?")) return;
        const res = await fetch(`/api/games/${gameId}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) { setError(data.error); return; }
        fetchGames(seasonId);
        flash("Game deleted!");
    };

    if (authLoading) return null;

    return (
        <>
            <Header />

            <section className="innerpage-section type2">
                <div className="banner-area"><img src="/assets/images/inner-banner1.jpg" alt="" /></div>
            </section>

            <section className="section-padding">
                <div className="container">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <h1>Admin Dashboard</h1>
                        <span className="badge bg-danger p-2">{user?.role?.toUpperCase()}</span>
                    </div>

                    {error && <div className="alert alert-danger">{error}</div>}
                    {success && <div className="alert alert-success">{success}</div>}

                    {/* Organizations */}
                    <AdminSection
                        title={`Organizations (${orgs.length})`}
                        onAdd={() => { setEditOrg(null); setShowOrgForm(true); }}
                        addLabel="Add Organization"
                    >
                        {showOrgForm && !editOrg && (
                            <OrgForm onSave={saveOrg} onCancel={() => setShowOrgForm(false)} />
                        )}

                        {loading ? (
                            <p>Loading...</p>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-dark table-hover">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Sport</th>
                                            <th>Location</th>
                                            <th>Rating</th>
                                            <th>Members</th>
                                            <th style={{ width: 200 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orgs.map((org) => (
                                            <>
                                                <tr key={org._id}>
                                                    <td>
                                                        <button className="btn btn-link text-white p-0 text-decoration-none" onClick={() => toggleOrg(org.slug)}>
                                                            {expandedOrg === org.slug ? "▼" : "▶"} {org.name}
                                                        </button>
                                                    </td>
                                                    <td>{org.sport}</td>
                                                    <td>{org.location}</td>
                                                    <td>⭐ {org.rating}</td>
                                                    <td>{org.memberCount}</td>
                                                    <td>
                                                        <button className="btn btn-outline-warning btn-sm me-1" onClick={() => { setEditOrg(org); setShowOrgForm(true); }}>Edit</button>
                                                        <button className="btn btn-outline-danger btn-sm me-1" onClick={() => deleteOrg(org.slug)}>Delete</button>
                                                        <Link href={`/organizations/${org.slug}`} className="btn btn-outline-info btn-sm">View</Link>
                                                    </td>
                                                </tr>

                                                {/* Edit form inline */}
                                                {editOrg && editOrg.slug === org.slug && (
                                                    <tr key={`edit-${org._id}`}>
                                                        <td colSpan={6}>
                                                            <OrgForm org={editOrg} onSave={saveOrg} onCancel={() => { setEditOrg(null); setShowOrgForm(false); }} />
                                                        </td>
                                                    </tr>
                                                )}

                                                {/* Expanded seasons */}
                                                {expandedOrg === org.slug && (
                                                    <tr key={`seasons-${org._id}`}>
                                                        <td colSpan={6} style={{ paddingLeft: 40, background: "rgba(255,255,255,0.02)" }}>
                                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                                <h5 className="mb-0">Seasons</h5>
                                                                <button className="btn btn-primary btn-sm" onClick={() => { setEditSeason(null); setShowSeasonForm(org.slug); }}>+ Add Season</button>
                                                            </div>

                                                            {showSeasonForm === org.slug && !editSeason && (
                                                                <SeasonForm orgSlug={org.slug} onSave={(d) => saveSeason(d, org.slug)} onCancel={() => setShowSeasonForm(null)} />
                                                            )}

                                                            {orgSeasons[org.slug]?.length > 0 ? (
                                                                <table className="table table-dark table-sm">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Name</th>
                                                                            <th>Type</th>
                                                                            <th>Category</th>
                                                                            <th>Location</th>
                                                                            <th style={{ width: 200 }}>Actions</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {orgSeasons[org.slug].map((season) => (
                                                                            <>
                                                                                <tr key={season._id}>
                                                                                    <td>
                                                                                        <button className="btn btn-link text-white p-0 text-decoration-none" onClick={() => toggleSeason(season._id)}>
                                                                                            {expandedSeason === season._id ? "▼" : "▶"} {season.name}
                                                                                        </button>
                                                                                    </td>
                                                                                    <td><span className={`badge ${season.type === "active" ? "bg-success" : "bg-secondary"}`}>{season.type}</span></td>
                                                                                    <td>{season.category}</td>
                                                                                    <td>{season.location}</td>
                                                                                    <td>
                                                                                        <button className="btn btn-outline-warning btn-sm me-1" onClick={() => { setEditSeason(season); setShowSeasonForm(org.slug); }}>Edit</button>
                                                                                        <button className="btn btn-outline-danger btn-sm" onClick={() => deleteSeason(season._id, org.slug)}>Delete</button>
                                                                                    </td>
                                                                                </tr>

                                                                                {editSeason && editSeason._id === season._id && (
                                                                                    <tr key={`edit-season-${season._id}`}>
                                                                                        <td colSpan={5}>
                                                                                            <SeasonForm season={editSeason} orgSlug={org.slug} onSave={(d) => saveSeason(d, org.slug)} onCancel={() => { setEditSeason(null); setShowSeasonForm(null); }} />
                                                                                        </td>
                                                                                    </tr>
                                                                                )}

                                                                                {/* Expanded games */}
                                                                                {expandedSeason === season._id && (
                                                                                    <tr key={`games-${season._id}`}>
                                                                                        <td colSpan={5} style={{ paddingLeft: 40, background: "rgba(255,255,255,0.02)" }}>
                                                                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                                                                <h6 className="mb-0">Games</h6>
                                                                                                <button className="btn btn-primary btn-sm" onClick={() => { setEditGame(null); setShowGameForm(season._id); }}>+ Add Game</button>
                                                                                            </div>

                                                                                            {showGameForm === season._id && !editGame && (
                                                                                                <GameForm onSave={(d) => saveGame(d, season._id, org.slug)} onCancel={() => setShowGameForm(null)} />
                                                                                            )}

                                                                                            {seasonGames[season._id]?.length > 0 ? (
                                                                                                <table className="table table-dark table-sm">
                                                                                                    <thead>
                                                                                                        <tr>
                                                                                                            <th>Date</th>
                                                                                                            <th>Time</th>
                                                                                                            <th>Team A</th>
                                                                                                            <th>Team B</th>
                                                                                                            <th>Status</th>
                                                                                                            <th>Score</th>
                                                                                                            <th style={{ width: 150 }}>Actions</th>
                                                                                                        </tr>
                                                                                                    </thead>
                                                                                                    <tbody>
                                                                                                        {seasonGames[season._id].map((game) => (
                                                                                                            <>
                                                                                                                <tr key={game._id}>
                                                                                                                    <td>{new Date(game.date).toLocaleDateString()}</td>
                                                                                                                    <td>{game.time}</td>
                                                                                                                    <td>{game.teamA.name}</td>
                                                                                                                    <td>{game.teamB.name}</td>
                                                                                                                    <td>
                                                                                                                        <span className={`badge ${game.status === "completed" ? "bg-success" : game.status === "in_progress" ? "bg-warning" : "bg-info"}`}>
                                                                                                                            {game.status}
                                                                                                                        </span>
                                                                                                                    </td>
                                                                                                                    <td>{game.status === "completed" ? `${game.teamA.score} - ${game.teamB.score}` : "-"}</td>
                                                                                                                    <td>
                                                                                                                        <button className="btn btn-outline-warning btn-sm me-1" onClick={() => { setEditGame(game); setShowGameForm(season._id); }}>Edit</button>
                                                                                                                        <button className="btn btn-outline-danger btn-sm" onClick={() => deleteGame(game._id, season._id)}>Delete</button>
                                                                                                                    </td>
                                                                                                                </tr>

                                                                                                                {editGame && editGame._id === game._id && (
                                                                                                                    <tr key={`edit-game-${game._id}`}>
                                                                                                                        <td colSpan={7}>
                                                                                                                            <GameForm game={editGame} onSave={(d) => saveGame(d, season._id, org.slug)} onCancel={() => { setEditGame(null); setShowGameForm(null); }} />
                                                                                                                        </td>
                                                                                                                    </tr>
                                                                                                                )}
                                                                                                            </>
                                                                                                        ))}
                                                                                                    </tbody>
                                                                                                </table>
                                                                                            ) : (
                                                                                                <p className="text-muted">No games yet.</p>
                                                                                            )}
                                                                                        </td>
                                                                                    </tr>
                                                                                )}
                                                                            </>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            ) : (
                                                                <p className="text-muted">No seasons yet.</p>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </AdminSection>
                </div>
            </section>

            <Footer />
        </>
    );
}
