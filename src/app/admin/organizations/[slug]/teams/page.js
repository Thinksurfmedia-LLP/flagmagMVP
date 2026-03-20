"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";
import { useToast } from "@/components/AdminToast";

function AddTeamModal({ onClose, onSave, leagues }) {
    const [form, setForm] = useState({ leagueId: "", divisionName: "", name: "", logo: "" });
    const [saving, setSaving] = useState(false);

    const selectedLeague = leagues.find(s => s._id === form.leagueId);
    const existingDivisions = selectedLeague?.divisions?.map(d => d.name) || [];

    const handleSave = async () => {
        setSaving(true);
        await onSave(form);
        setSaving(false);
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <h3 className="admin-modal-title">Add Team</h3>
                <div className="admin-form-group">
                    <label className="admin-form-label">League *</label>
                    <select className="admin-form-select" value={form.leagueId} onChange={e => setForm({ ...form, leagueId: e.target.value })}>
                        <option value="">Select a league...</option>
                        {leagues.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Division</label>
                    <input className="admin-form-input" value={form.divisionName} onChange={e => setForm({ ...form, divisionName: e.target.value })} placeholder="e.g. East, West, Default" list="divisionOptions" />
                    {existingDivisions.length > 0 && (
                        <datalist id="divisionOptions">
                            {existingDivisions.map(d => <option key={d} value={d} />)}
                        </datalist>
                    )}
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Team Name *</label>
                    <input className="admin-form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Eagles" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Logo URL</label>
                    <input className="admin-form-input" value={form.logo} onChange={e => setForm({ ...form, logo: e.target.value })} placeholder="https://..." />
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving || !form.leagueId || !form.name}>
                        {saving ? "Saving..." : "Add Team"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function OrgTeamsPage() {
    const { slug } = useParams();
    const { user } = useAuth();
    const { org: impersonatedOrg, enterImpersonation } = useImpersonation();
    const { showSuccess, showError } = useToast();

    const [teams, setTeams] = useState([]);
    const [leagues, setLeagues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterLeague, setFilterLeague] = useState("");
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        if (!impersonatedOrg && slug) {
            fetch(`/api/organizations/${slug}`)
                .then(r => r.json())
                .then(d => { if (d.success) enterImpersonation(d.data); })
                .catch(() => {});
        }
    }, [slug, impersonatedOrg, enterImpersonation]);

    const fetchTeams = useCallback(async () => {
        try {
            const res = await fetch(`/api/organizations/${slug}/teams`);
            const data = await res.json();
            if (data.success) setTeams(data.data);
        } catch { showError("Failed to load teams"); }
        finally { setLoading(false); }
    }, [slug]);

    useEffect(() => { fetchTeams(); }, [fetchTeams]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/organizations/${slug}/leagues`);
                const data = await res.json();
                if (data.success) setLeagues(data.data);
            } catch { /* ignored */ }
        })();
    }, [slug]);

    const handleAddTeam = async (form) => {
        try {
            const res = await fetch(`/api/organizations/${slug}/teams`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            showSuccess("Team added!");
            setShowModal(false);
            fetchTeams();
        } catch { showError("Failed to add team"); }
    };

    const filtered = filterLeague ? teams.filter(t => t.leagueId === filterLeague) : teams;
    const canManage = user && hasAccess(user, "manage_organizations");
    const orgName = impersonatedOrg?.name || slug;

    return (
        <AdminLayout title="Teams">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage teams.</p>
                </div>
            ) : (
                <>
                    <div className="admin-card" style={{ marginBottom: 16 }}>
                        <div className="admin-card-body" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                            <div style={{ flex: 1, minWidth: 200 }}>
                                <label className="admin-form-label">Filter by League</label>
                                <select className="admin-form-select" value={filterLeague} onChange={e => setFilterLeague(e.target.value)}>
                                    <option value="">All Leagues</option>
                                    {leagues.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                                </select>
                            </div>
                            <button className="admin-btn admin-btn-primary" style={{ alignSelf: "flex-end" }} onClick={() => setShowModal(true)}>
                                <i className="fa-solid fa-plus"></i> Add Team
                            </button>
                        </div>
                    </div>

                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3>{orgName} — Teams ({filtered.length})</h3>
                        </div>

                        {loading ? (
                            <div className="admin-loading"><div className="admin-spinner"></div>Loading teams...</div>
                        ) : filtered.length === 0 ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-people-group"></i>
                                <p>No teams found. Add a team to a league to get started.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Team</th>
                                            <th>League</th>
                                            <th>Division</th>
                                            <th>W</th>
                                            <th>L</th>
                                            <th>PCT</th>
                                            <th>PF</th>
                                            <th>PA</th>
                                            <th>DIFF</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map((t, i) => (
                                            <tr key={`${t.leagueId}-${t._id || i}`}>
                                                <td style={{ fontWeight: 600 }}>
                                                    {t.logo && <img src={t.logo} alt="" style={{ width: 20, height: 20, borderRadius: 4, marginRight: 8, verticalAlign: "middle" }} />}
                                                    {t.name}
                                                </td>
                                                <td style={{ color: "#5a5f72" }}>{t.leagueName}</td>
                                                <td style={{ color: "#5a5f72" }}>{t.divisionName}</td>
                                                <td>{t.wins || 0}</td>
                                                <td>{t.losses || 0}</td>
                                                <td>{t.pct != null ? t.pct.toFixed(3) : ".000"}</td>
                                                <td>{t.pf || 0}</td>
                                                <td>{t.pa || 0}</td>
                                                <td>{t.diff || 0}</td>
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
                <AddTeamModal
                    leagues={leagues}
                    onClose={() => setShowModal(false)}
                    onSave={handleAddTeam}
                />
            )}
        </AdminLayout>
    );
}
