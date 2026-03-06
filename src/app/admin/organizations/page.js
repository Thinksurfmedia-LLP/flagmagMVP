"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import Link from "next/link";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";

function OrgForm({ org, onSave, onCancel }) {
    const [form, setForm] = useState(
        org || {
            name: "", slug: "", description: "", location: "",
            sport: "Flag Football", rating: 0, memberCount: 0,
            foundedYear: new Date().getFullYear(), tags: [], scheduleDays: [],
        }
    );
    const [tagInput, setTagInput] = useState(org?.tags?.join(", ") || "");
    const [daysInput, setDaysInput] = useState(org?.scheduleDays?.join(", ") || "");

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            ...form,
            tags: tagInput.split(",").map(t => t.trim()).filter(Boolean),
            scheduleDays: daysInput.split(",").map(d => d.trim().toUpperCase()).filter(Boolean),
        });
    };

    return (
        <div className="admin-inline-form">
            <form onSubmit={handleSubmit}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Name *</label>
                        <input className="admin-form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Sport</label>
                        <select className="admin-form-select" value={form.sport} onChange={e => setForm({ ...form, sport: e.target.value })}>
                            <option>Flag Football</option>
                            <option>Basketball</option>
                            <option>Soccer</option>
                            <option>Pickleball</option>
                            <option>Other</option>
                        </select>
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Location</label>
                        <input className="admin-form-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Founded Year</label>
                        <input type="number" className="admin-form-input" value={form.foundedYear} onChange={e => setForm({ ...form, foundedYear: +e.target.value })} />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Rating (0-5)</label>
                        <input type="number" step="0.1" min="0" max="5" className="admin-form-input" value={form.rating} onChange={e => setForm({ ...form, rating: +e.target.value })} />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Tags (comma-separated)</label>
                        <input className="admin-form-input" value={tagInput} onChange={e => setTagInput(e.target.value)} placeholder="Coed, Men's, Youth" />
                    </div>
                    <div className="admin-form-group" style={{ gridColumn: "span 2" }}>
                        <label className="admin-form-label">Description</label>
                        <textarea className="admin-form-input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Schedule Days</label>
                        <input className="admin-form-input" value={daysInput} onChange={e => setDaysInput(e.target.value)} placeholder="MON, WED, SAT" />
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button type="submit" className="admin-btn admin-btn-primary">Save</button>
                    <button type="button" className="admin-btn admin-btn-ghost" onClick={onCancel}>Cancel</button>
                </div>
            </form>
        </div>
    );
}

function SeasonForm({ season, onSave, onCancel }) {
    const [form, setForm] = useState(
        season || { name: "", type: "active", category: "coed", location: "", time: "" }
    );
    const handleSubmit = (e) => { e.preventDefault(); onSave(form); };

    return (
        <div className="admin-inline-form">
            <form onSubmit={handleSubmit}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Season Name *</label>
                        <input className="admin-form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Type</label>
                        <select className="admin-form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                            <option value="active">Active</option>
                            <option value="past">Past</option>
                        </select>
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Category</label>
                        <select className="admin-form-select" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                            <option value="coed">Coed</option>
                            <option value="men">Men</option>
                            <option value="women">Women</option>
                            <option value="youth">Youth</option>
                        </select>
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Location</label>
                        <input className="admin-form-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Time</label>
                        <input className="admin-form-input" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} placeholder="5:00 PM" />
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button type="submit" className="admin-btn admin-btn-primary">Save</button>
                    <button type="button" className="admin-btn admin-btn-ghost" onClick={onCancel}>Cancel</button>
                </div>
            </form>
        </div>
    );
}

function GameForm({ game, onSave, onCancel }) {
    const [form, setForm] = useState(
        game || { date: "", time: "", teamA: { name: "", score: null }, teamB: { name: "", score: null }, location: "", status: "upcoming" }
    );
    const handleSubmit = (e) => { e.preventDefault(); onSave(form); };

    return (
        <div className="admin-inline-form">
            <form onSubmit={handleSubmit}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Date *</label>
                        <input type="date" className="admin-form-input" value={form.date ? form.date.substring(0, 10) : ""} onChange={e => setForm({ ...form, date: e.target.value })} required />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Time</label>
                        <input className="admin-form-input" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} placeholder="17:00" />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Location</label>
                        <input className="admin-form-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Team A *</label>
                        <input className="admin-form-input" value={form.teamA.name} onChange={e => setForm({ ...form, teamA: { ...form.teamA, name: e.target.value } })} required />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Team B *</label>
                        <input className="admin-form-input" value={form.teamB.name} onChange={e => setForm({ ...form, teamB: { ...form.teamB, name: e.target.value } })} required />
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
                        <>
                            <div className="admin-form-group">
                                <label className="admin-form-label">Score A</label>
                                <input type="number" className="admin-form-input" value={form.teamA.score || ""} onChange={e => setForm({ ...form, teamA: { ...form.teamA, score: +e.target.value } })} />
                            </div>
                            <div className="admin-form-group">
                                <label className="admin-form-label">Score B</label>
                                <input type="number" className="admin-form-input" value={form.teamB.score || ""} onChange={e => setForm({ ...form, teamB: { ...form.teamB, score: +e.target.value } })} />
                            </div>
                        </>
                    )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button type="submit" className="admin-btn admin-btn-primary">Save</button>
                    <button type="button" className="admin-btn admin-btn-ghost" onClick={onCancel}>Cancel</button>
                </div>
            </form>
        </div>
    );
}

export default function AdminOrganizationsPage() {
    const { user } = useAuth();
    const [orgs, setOrgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
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

    const flash = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(""), 3000); };

    const fetchOrgs = useCallback(async () => {
        try {
            const res = await fetch("/api/organizations");
            const data = await res.json();
            if (data.success) setOrgs(data.data);
        } catch { setError("Failed to load organizations"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

    const saveOrg = async (formData) => {
        setError("");
        const isEdit = !!editOrg;
        const url = isEdit ? `/api/organizations/${editOrg.slug}` : "/api/organizations";
        const method = isEdit ? "PUT" : "POST";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
        const data = await res.json();
        if (!data.success) { setError(data.error); return; }
        setShowOrgForm(false); setEditOrg(null); fetchOrgs();
        flash(isEdit ? "Organization updated!" : "Organization created!");
    };

    const deleteOrg = async (slug) => {
        if (!confirm("Delete this organization? This cannot be undone.")) return;
        const res = await fetch(`/api/organizations/${slug}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) { setError(data.error); return; }
        fetchOrgs(); flash("Organization deleted!");
    };

    const fetchSeasons = async (slug) => {
        const res = await fetch(`/api/organizations/${slug}/seasons`);
        const data = await res.json();
        if (data.success) setOrgSeasons(prev => ({ ...prev, [slug]: data.data }));
    };

    const toggleOrg = (slug) => {
        if (expandedOrg === slug) { setExpandedOrg(null); }
        else { setExpandedOrg(slug); if (!orgSeasons[slug]) fetchSeasons(slug); }
    };

    const saveSeason = async (formData, orgSlug) => {
        setError("");
        const isEdit = !!editSeason;
        const url = isEdit ? `/api/seasons/${editSeason._id}` : `/api/organizations/${orgSlug}/seasons`;
        const method = isEdit ? "PUT" : "POST";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
        const data = await res.json();
        if (!data.success) { setError(data.error); return; }
        setShowSeasonForm(null); setEditSeason(null); fetchSeasons(orgSlug);
        flash(isEdit ? "Season updated!" : "Season created!");
    };

    const deleteSeason = async (seasonId, orgSlug) => {
        if (!confirm("Delete this season?")) return;
        const res = await fetch(`/api/seasons/${seasonId}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) { setError(data.error); return; }
        fetchSeasons(orgSlug); flash("Season deleted!");
    };

    const fetchGames = async (seasonId) => {
        const res = await fetch(`/api/seasons/${seasonId}/games`);
        const data = await res.json();
        if (data.success) setSeasonGames(prev => ({ ...prev, [seasonId]: data.data }));
    };

    const toggleSeason = (seasonId) => {
        if (expandedSeason === seasonId) { setExpandedSeason(null); }
        else { setExpandedSeason(seasonId); if (!seasonGames[seasonId]) fetchGames(seasonId); }
    };

    const saveGame = async (formData, seasonId, orgSlug) => {
        setError("");
        const isEdit = !!editGame;
        const url = isEdit ? `/api/games/${editGame._id}` : `/api/seasons/${seasonId}/games`;
        const method = isEdit ? "PUT" : "POST";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
        const data = await res.json();
        if (!data.success) { setError(data.error); return; }
        setShowGameForm(null); setEditGame(null); fetchGames(seasonId);
        flash(isEdit ? "Game updated!" : "Game created!");
    };

    const deleteGame = async (gameId, seasonId) => {
        if (!confirm("Delete this game?")) return;
        const res = await fetch(`/api/games/${gameId}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) { setError(data.error); return; }
        fetchGames(seasonId); flash("Game deleted!");
    };

    const canManage = user && hasAccess(user, "manage_organizations");

    return (
        <AdminLayout title="Organizations">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage organizations.</p>
                </div>
            ) : (
                <>
                    {success && <div className="admin-alert admin-alert-success"><i className="fa-solid fa-check-circle"></i> {success}</div>}
                    {error && <div className="admin-alert admin-alert-error"><i className="fa-solid fa-exclamation-circle"></i> {error}</div>}

                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3>Organizations ({orgs.length})</h3>
                            <button className="admin-btn admin-btn-primary" onClick={() => { setEditOrg(null); setShowOrgForm(true); }}>
                                <i className="fa-solid fa-plus"></i> Add Organization
                            </button>
                        </div>

                        <div className="admin-card-body">
                            {showOrgForm && !editOrg && (
                                <OrgForm onSave={saveOrg} onCancel={() => setShowOrgForm(false)} />
                            )}

                            {loading ? (
                                <div style={{ textAlign: "center", padding: 32, color: "rgba(255,255,255,0.4)" }}>Loading...</div>
                            ) : orgs.length === 0 ? (
                                <div className="admin-empty">
                                    <i className="fa-solid fa-building"></i>
                                    <p>No organizations yet. Create your first one above.</p>
                                </div>
                            ) : (
                                <div style={{ overflowX: "auto" }}>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Sport</th>
                                                <th>Location</th>
                                                <th>Rating</th>
                                                <th>Members</th>
                                                <th style={{ width: 180 }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orgs.map(org => (
                                                <Fragment key={org._id}>
                                                    <tr>
                                                        <td>
                                                            <button className="admin-expand-btn" onClick={() => toggleOrg(org.slug)}>
                                                                <i className={`fa-solid fa-chevron-${expandedOrg === org.slug ? "down" : "right"}`} style={{ fontSize: 11 }}></i>
                                                                <strong>{org.name}</strong>
                                                            </button>
                                                        </td>
                                                        <td>{org.sport}</td>
                                                        <td>{org.location}</td>
                                                        <td>⭐ {org.rating}</td>
                                                        <td>{org.memberCount}</td>
                                                        <td style={{ width: 180 }}>
                                                            <div style={{ display: "flex", gap: 6 }}>
                                                                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => { setEditOrg(org); setShowOrgForm(true); }}>
                                                                    <i className="fa-solid fa-pen"></i>
                                                                </button>
                                                                <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteOrg(org.slug)}>
                                                                    <i className="fa-solid fa-trash"></i>
                                                                </button>
                                                                <Link href={`/organizations/${org.slug}`} className="admin-btn admin-btn-ghost admin-btn-sm">
                                                                    <i className="fa-solid fa-eye"></i>
                                                                </Link>
                                                            </div>
                                                        </td>
                                                    </tr>

                                                    {/* Edit form */}
                                                    {editOrg && editOrg.slug === org.slug && (
                                                        <tr><td colSpan={6} style={{ padding: "0 16px 16px" }}>
                                                            <OrgForm org={editOrg} onSave={saveOrg} onCancel={() => { setEditOrg(null); setShowOrgForm(false); }} />
                                                        </td></tr>
                                                    )}

                                                    {/* Expanded seasons */}
                                                    {expandedOrg === org.slug && (
                                                        <tr><td colSpan={6} style={{ padding: 0 }}>
                                                            <div className="admin-nested">
                                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                                                    <h4 style={{ fontSize: 14, fontWeight: 600, color: "#1a1d26", margin: 0 }}>Seasons</h4>
                                                                    <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => { setEditSeason(null); setShowSeasonForm(org.slug); }}>
                                                                        <i className="fa-solid fa-plus"></i> Add Season
                                                                    </button>
                                                                </div>

                                                                {showSeasonForm === org.slug && !editSeason && (
                                                                    <SeasonForm onSave={d => saveSeason(d, org.slug)} onCancel={() => setShowSeasonForm(null)} />
                                                                )}

                                                                {orgSeasons[org.slug]?.length > 0 ? (
                                                                    <table className="admin-table">
                                                                        <thead>
                                                                            <tr><th>Name</th><th>Type</th><th>Category</th><th>Location</th><th style={{ width: 140 }}>Actions</th></tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {orgSeasons[org.slug].map(season => (
                                                                                <Fragment key={season._id}>
                                                                                    <tr>
                                                                                        <td>
                                                                                            <button className="admin-expand-btn" onClick={() => toggleSeason(season._id)}>
                                                                                                <i className={`fa-solid fa-chevron-${expandedSeason === season._id ? "down" : "right"}`} style={{ fontSize: 10 }}></i>
                                                                                                {season.name}
                                                                                            </button>
                                                                                        </td>
                                                                                        <td>
                                                                                            <span className={`admin-badge ${season.type === "active" ? "player" : ""}`}>{season.type}</span>
                                                                                        </td>
                                                                                        <td>{season.category}</td>
                                                                                        <td>{season.location}</td>
                                                                                        <td style={{ width: 140 }}>
                                                                                            <div style={{ display: "flex", gap: 6 }}>
                                                                                                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => { setEditSeason(season); setShowSeasonForm(org.slug); }}>
                                                                                                    <i className="fa-solid fa-pen"></i>
                                                                                                </button>
                                                                                                <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteSeason(season._id, org.slug)}>
                                                                                                    <i className="fa-solid fa-trash"></i>
                                                                                                </button>
                                                                                            </div>
                                                                                        </td>
                                                                                    </tr>

                                                                                    {editSeason && editSeason._id === season._id && (
                                                                                        <tr><td colSpan={5} style={{ padding: "0 16px 12px" }}>
                                                                                            <SeasonForm season={editSeason} onSave={d => saveSeason(d, org.slug)} onCancel={() => { setEditSeason(null); setShowSeasonForm(null); }} />
                                                                                        </td></tr>
                                                                                    )}

                                                                                    {expandedSeason === season._id && (
                                                                                        <tr><td colSpan={5} style={{ padding: 0 }}>
                                                                                            <div className="admin-nested">
                                                                                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                                                                                    <h5 style={{ fontSize: 13, fontWeight: 600, color: "#1a1d26", margin: 0 }}>Games</h5>
                                                                                                    <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => { setEditGame(null); setShowGameForm(season._id); }}>
                                                                                                        <i className="fa-solid fa-plus"></i> Add Game
                                                                                                    </button>
                                                                                                </div>

                                                                                                {showGameForm === season._id && !editGame && (
                                                                                                    <GameForm onSave={d => saveGame(d, season._id, org.slug)} onCancel={() => setShowGameForm(null)} />
                                                                                                )}

                                                                                                {seasonGames[season._id]?.length > 0 ? (
                                                                                                    <table className="admin-table">
                                                                                                        <thead>
                                                                                                            <tr><th>Date</th><th>Time</th><th>Team A</th><th>Team B</th><th>Status</th><th>Score</th><th style={{ width: 100 }}>Actions</th></tr>
                                                                                                        </thead>
                                                                                                        <tbody>
                                                                                                            {seasonGames[season._id].map(game => (
                                                                                                                <Fragment key={game._id}>
                                                                                                                    <tr>
                                                                                                                        <td>{new Date(game.date).toLocaleDateString()}</td>
                                                                                                                        <td>{game.time}</td>
                                                                                                                        <td>{game.teamA.name}</td>
                                                                                                                        <td>{game.teamB.name}</td>
                                                                                                                        <td>
                                                                                                                            <span className={`admin-badge ${game.status === "completed" ? "player" : game.status === "in_progress" ? "organizer" : ""}`}>
                                                                                                                                {game.status}
                                                                                                                            </span>
                                                                                                                        </td>
                                                                                                                        <td>
                                                                                                                            {game.status === "completed" ? `${game.teamA.score} - ${game.teamB.score}` : "—"}
                                                                                                                        </td>
                                                                                                                        <td style={{ width: 100 }}>
                                                                                                                            <div style={{ display: "flex", gap: 6 }}>
                                                                                                                                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => { setEditGame(game); setShowGameForm(season._id); }}>
                                                                                                                                    <i className="fa-solid fa-pen"></i>
                                                                                                                                </button>
                                                                                                                                <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteGame(game._id, season._id)}>
                                                                                                                                    <i className="fa-solid fa-trash"></i>
                                                                                                                                </button>
                                                                                                                            </div>
                                                                                                                        </td>
                                                                                                                    </tr>

                                                                                                                    {editGame && editGame._id === game._id && (
                                                                                                                        <tr><td colSpan={7} style={{ padding: "0 16px 12px" }}>
                                                                                                                            <GameForm game={editGame} onSave={d => saveGame(d, season._id, org.slug)} onCancel={() => { setEditGame(null); setShowGameForm(null); }} />
                                                                                                                        </td></tr>
                                                                                                                    )}
                                                                                                                </Fragment>
                                                                                                            ))}
                                                                                                        </tbody>
                                                                                                    </table>
                                                                                                ) : (
                                                                                                    <div style={{ color: "#8b90a0", fontSize: 13, padding: "8px 0" }}>No games yet.</div>
                                                                                                )}
                                                                                            </div>
                                                                                        </td></tr>
                                                                                    )}
                                                                                </Fragment>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                ) : (
                                                                    <div style={{ color: "#8b90a0", fontSize: 13, padding: "8px 0" }}>No seasons yet.</div>
                                                                )}
                                                            </div>
                                                        </td></tr>
                                                    )}
                                                </Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </AdminLayout>
    );
}
