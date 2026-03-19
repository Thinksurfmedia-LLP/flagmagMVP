"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout, { hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

function TeamModal({ team, players, organizations, user, effectiveRole, onClose, onSave }) {
    const [name, setName] = useState(team?.name || "");
    const [logo, setLogo] = useState(team?.logo || "");
    const [organization, setOrganization] = useState(
        team?.organization?._id || team?.organization || user?.organization?.id || ""
    );
    const [query, setQuery] = useState("");
    const [selectedPlayerIds, setSelectedPlayerIds] = useState((team?.players || []).map((player) => String(player._id || player)));
    const [saving, setSaving] = useState(false);

    const eligiblePlayers = useMemo(() => {
        if (effectiveRole !== "organizer") return players;

        const organizerOrgId = user?.organization?.id ? String(user.organization.id) : "";

        return players.filter((player) => {
            const playerOrgId = player.organization
                ? String(player.organization._id || player.organization)
                : "";
            return !playerOrgId || playerOrgId === organizerOrgId;
        });
    }, [players, user, effectiveRole]);

    const filteredPlayers = eligiblePlayers.filter((player) => {
        const haystack = `${player.name} ${player.presentTeam?.name || ""}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
    });

    const togglePlayer = (playerId) => {
        const id = String(playerId);
        setSelectedPlayerIds((prev) => (
            prev.includes(id)
                ? prev.filter((entry) => entry !== id)
                : [...prev, id]
        ));
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setSaving(true);
        await onSave({
            name: name.trim(),
            logo: logo.trim(),
            organization: effectiveRole === "admin" ? organization : undefined,
            players: selectedPlayerIds,
        });
        setSaving(false);
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 640 }}>
                <h3 className="admin-modal-title">{team ? "Edit Team" : "Create Team"}</h3>

                <div className="admin-form-group">
                    <label className="admin-form-label">Team Name *</label>
                    <input className="admin-form-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Darkside" />
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">Logo URL (optional)</label>
                    <input className="admin-form-input" value={logo} onChange={(event) => setLogo(event.target.value)} placeholder="/assets/images/teamlogo1.png" />
                </div>

                {effectiveRole === "admin" && (
                    <div className="admin-form-group">
                        <label className="admin-form-label">Organization *</label>
                        <select className="admin-form-select" value={organization} onChange={(event) => setOrganization(event.target.value)}>
                            <option value="">Select organization</option>
                            {(organizations || []).map((org) => (
                                <option key={org._id} value={org._id}>{org.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="admin-form-group">
                    <label className="admin-form-label">Assign Players</label>
                    <input
                        className="admin-form-input"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search players..."
                        style={{ marginBottom: 8 }}
                    />
                    <div className="admin-location-list" style={{ maxHeight: 240 }}>
                        {filteredPlayers.length > 0 ? filteredPlayers.map((player) => {
                            const checked = selectedPlayerIds.includes(String(player._id));
                            return (
                                <label key={player._id} className={`admin-location-option ${checked ? "selected" : ""}`}>
                                    <input type="checkbox" checked={checked} onChange={() => togglePlayer(player._id)} />
                                    <span>
                                        <strong>{player.name}</strong>
                                        <small>Current team: {player.presentTeam?.name || "Unassigned"}</small>
                                    </span>
                                </label>
                            );
                        }) : (
                            <div style={{ color: "#8b90a0", fontSize: 13 }}>No matching players.</div>
                        )}
                    </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Cancel</button>
                    <button
                        className="admin-btn admin-btn-primary"
                        onClick={handleSave}
                        disabled={saving || !name.trim() || (effectiveRole === "admin" && !organization)}
                    >
                        {saving ? "Saving..." : team ? "Save Changes" : "Create Team"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function AdminTeamsPage() {
    const { user, activeRole } = useAuth();
    const effectiveRole = activeRole || user?.role;
    const { showSuccess, showError } = useToast();

    const [teams, setTeams] = useState([]);
    const [players, setPlayers] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);

    const canView = hasAnyAccess(user, [
        "manage_teams", "team_view", "team_create", "team_update", "team_delete",
        "manage_players", "player_view", "player_update",
        "manage_organizations", "organization_update",
    ]);
    const canCreate = hasAnyAccess(user, ["manage_teams", "team_create"]);
    const canUpdate = hasAnyAccess(user, ["manage_teams", "team_update"]);
    const canDelete = hasAnyAccess(user, ["manage_teams", "team_delete"]);

    const fetchData = useCallback(async () => {
        if (!canView) {
            setLoading(false);
            return;
        }

        try {
            const [teamsRes, playersRes] = await Promise.all([
                fetch("/api/teams"),
                fetch("/api/players"),
            ]);
            const [teamsData, playersData] = await Promise.all([teamsRes.json(), playersRes.json()]);

            if (teamsData.success) setTeams(teamsData.data || []);
            else showError(teamsData.error || "Failed to load teams");

            if (playersData.success) setPlayers(playersData.data || []);
            else showError(playersData.error || "Failed to load players");

            if (effectiveRole === "admin") {
                const orgRes = await fetch("/api/organizations");
                const orgData = await orgRes.json();
                if (orgData.success) setOrganizations(orgData.data || []);
            }
        } catch {
            showError("Failed to load teams and players");
        } finally {
            setLoading(false);
        }
    }, [canView, showError, effectiveRole]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const saveTeam = async (payload) => {
        try {
            const isEdit = Boolean(editTarget);
            const res = await fetch(isEdit ? `/api/teams/${editTarget._id}` : "/api/teams", {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!data.success) {
                showError(data.error || "Failed to save team");
                return;
            }

            setModalOpen(false);
            setEditTarget(null);
            fetchData();
            showSuccess(isEdit ? "Team updated!" : "Team created!");
        } catch {
            showError("Failed to save team");
        }
    };

    const deleteTeam = async (team) => {
        if (!confirm(`Delete team "${team.name}"?`)) return;

        try {
            const res = await fetch(`/api/teams/${team._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) {
                showError(data.error || "Failed to delete team");
                return;
            }
            fetchData();
            showSuccess("Team deleted!");
        } catch {
            showError("Failed to delete team");
        }
    };

    return (
        <AdminLayout title="Teams">
            {!canView ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage teams.</p>
                </div>
            ) : (
                <>
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3>Teams ({teams.length})</h3>
                            {canCreate && (
                                <button className="admin-btn admin-btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
                                    <i className="fa-solid fa-plus"></i> Create Team
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <div className="admin-loading">
                                <div className="admin-spinner"></div>
                                Loading teams...
                            </div>
                        ) : teams.length === 0 ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-people-group"></i>
                                <p>No teams yet. Create one and assign players.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Team</th>
                                            <th>Organization</th>
                                            <th>Players</th>
                                            <th style={{ width: 130 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teams.map((team) => (
                                            <tr key={team._id}>
                                                <td style={{ fontWeight: 600 }}>{team.name}</td>
                                                <td>{team.organization?.name || "—"}</td>
                                                <td>{team.players?.length || 0}</td>
                                                <td>
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        {canUpdate && (
                                                            <button
                                                                className="admin-btn admin-btn-ghost admin-btn-sm"
                                                                onClick={() => { setEditTarget(team); setModalOpen(true); }}
                                                                title="Edit"
                                                            >
                                                                <i className="fa-solid fa-pen"></i>
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                className="admin-btn admin-btn-danger admin-btn-sm"
                                                                onClick={() => deleteTeam(team)}
                                                                title="Delete"
                                                            >
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

                    {modalOpen && (
                        <TeamModal
                            team={editTarget}
                            players={players}
                            organizations={organizations}
                            user={user}
                            effectiveRole={effectiveRole}
                            onClose={() => { setModalOpen(false); setEditTarget(null); }}
                            onSave={saveTeam}
                        />
                    )}
                </>
            )}
        </AdminLayout>
    );
}
