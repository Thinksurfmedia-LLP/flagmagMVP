"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import React from "react";
import { US_STATES, US_COUNTIES } from "@/lib/usGeoData";
import AdminLayout, { hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

function ImageUploadField({ value, onChange, placeholder, onError }) {
    const [uploading, setUploading] = useState(false);
    const inputRef = React.useRef();

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (data.success) onChange(data.url);
            else onError(data.error || "Upload failed");
        } catch {
            onError("Upload failed");
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };

    return (
        <div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                    className="admin-form-input"
                    style={{ flex: 1 }}
                    value={value || ""}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder || "https://..."}
                />
                <button
                    type="button"
                    className="admin-btn admin-btn-ghost admin-btn-sm"
                    style={{ whiteSpace: "nowrap", height: 42 }}
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading}
                >
                    {uploading ? "Uploading..." : <><i className="fa-solid fa-upload" style={{ marginRight: 6 }}></i>Upload</>}
                </button>
                <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
            </div>
            {value && (
                <img src={value} alt="" style={{ marginTop: 8, height: 56, borderRadius: 6, border: "1px solid #e5e7ef", objectFit: "cover" }} />
            )}
        </div>
    );
}

function TeamModal({ team, freeAgents, organizations, user, effectiveRole, onClose, onSave }) {
    const { showError } = useToast();
    const [name, setName] = useState(team?.name || "");
    const [logo, setLogo] = useState(team?.logo || "");
    const [description, setDescription] = useState(team?.description || "");
    const [division, setDivision] = useState(team?.division || "");
    const [organization, setOrganization] = useState(
        team?.organization?._id || team?.organization || user?.organization?.id || ""
    );
    const [query, setQuery] = useState("");
    const [selectedPlayerIds, setSelectedPlayerIds] = useState((team?.players || []).map((player) => String(player._id || player)));
    const [saving, setSaving] = useState(false);

    // Location picker state
    const [pickerState, setPickerState] = useState(team?.location?.stateAbbr || "");
    const [pickerCounty, setPickerCounty] = useState(team?.location?.countyName || "");
    const [pickerCity, setPickerCity] = useState(team?.location?.cityName || "");
    const [cityOptions, setCityOptions] = useState([]);
    const [loadingCities, setLoadingCities] = useState(false);

    const fetchCities = async (state, county) => {
        if (!state || !county) { setCityOptions([]); return; }
        setLoadingCities(true);
        try {
            const res = await fetch(`/api/cities?state=${encodeURIComponent(state)}&county=${encodeURIComponent(county)}`);
            const data = await res.json();
            if (data.success) setCityOptions(data.data);
            else setCityOptions([]);
        } catch { setCityOptions([]); }
        finally { setLoadingCities(false); }
    };

    const noCityData = pickerCounty && !loadingCities && cityOptions.length === 0;

    // Pre-fetch cities when editing a team with existing location
    useEffect(() => {
        if (pickerState && pickerCounty) {
            fetchCities(pickerState, pickerCounty);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Merge existing team players with free agents for the candidate list
    const allCandidates = useMemo(() => {
        const existingPlayers = (team?.players || []).map(p => ({
            ...p,
            _isExistingTeamPlayer: true,
        }));
        const existingIds = new Set(existingPlayers.map(p => String(p._id || p)));
        const newFreeAgents = (freeAgents || []).filter(fa => !existingIds.has(String(fa._id)));
        return [...existingPlayers, ...newFreeAgents];
    }, [team, freeAgents]);

    const filteredPlayers = allCandidates.filter((player) => {
        const haystack = `${player.name} ${player.organization?.name || ""}`.toLowerCase();
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

        const locationPayload = pickerState ? {
            stateName: US_STATES.find((s) => s.abbr === pickerState)?.name || "",
            stateAbbr: pickerState,
            countyName: pickerCounty || "",
            cityName: pickerCity?.trim() || "",
        } : {};

        await onSave({
            name: name.trim(),
            logo: logo.trim(),
            description: description.trim(),
            division: division.trim(),
            location: locationPayload,
            organization: effectiveRole === "admin" ? organization : undefined,
            players: selectedPlayerIds,
        });
        setSaving(false);
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}>
                <h3 className="admin-modal-title">{team ? "Edit Team" : "Create Team"}</h3>

                <div className="admin-form-group">
                    <label className="admin-form-label">Team Name *</label>
                    <input className="admin-form-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Darkside" />
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">Logo (optional)</label>
                    <ImageUploadField
                        value={logo}
                        onChange={setLogo}
                        placeholder="https://... or upload"
                        onError={showError}
                    />
                    {!logo && (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, color: "#8b90a0", fontSize: 13 }}>
                            <i className="fa-solid fa-shield-halved"></i>
                            A default placeholder will be used
                        </div>
                    )}
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
                    <label className="admin-form-label">Description (optional)</label>
                    <textarea
                        className="admin-form-input"
                        rows={3}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Brief description of this team..."
                        style={{ resize: "vertical" }}
                    />
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">Division (optional)</label>
                    <input
                        className="admin-form-input"
                        value={division}
                        onChange={(event) => setDivision(event.target.value)}
                        placeholder="e.g. Division A, Open, Competitive"
                    />
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">Origin Location (optional)</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <select
                            className="admin-form-select"
                            style={{ flex: 1, minWidth: 140 }}
                            value={pickerState}
                            onChange={(e) => {
                                setPickerState(e.target.value);
                                setPickerCounty("");
                                setPickerCity("");
                                setCityOptions([]);
                            }}
                        >
                            <option value="">Select state...</option>
                            {US_STATES.map((s) => (
                                <option key={s.abbr} value={s.abbr}>{s.name} ({s.abbr})</option>
                            ))}
                        </select>
                        <select
                            className="admin-form-select"
                            style={{ flex: 1, minWidth: 140 }}
                            value={pickerCounty}
                            onChange={(e) => {
                                setPickerCounty(e.target.value);
                                setPickerCity("");
                                fetchCities(pickerState, e.target.value);
                            }}
                            disabled={!pickerState}
                        >
                            <option value="">Select county...</option>
                            {(US_COUNTIES[pickerState] || []).map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        {noCityData ? (
                            <input
                                className="admin-form-input"
                                style={{ flex: 1, minWidth: 140 }}
                                value={pickerCity}
                                onChange={(e) => setPickerCity(e.target.value)}
                                placeholder="City (optional)"
                            />
                        ) : (
                            <select
                                className="admin-form-select"
                                style={{ flex: 1, minWidth: 140 }}
                                value={pickerCity}
                                onChange={(e) => setPickerCity(e.target.value)}
                                disabled={!pickerCounty || loadingCities}
                            >
                                <option value="">{loadingCities ? "Loading cities..." : "Select city..."}</option>
                                {cityOptions.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">Assign Free Agents</label>
                    <input
                        className="admin-form-input"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search free agents..."
                        style={{ marginBottom: 8 }}
                    />
                    <div className="admin-location-list" style={{ maxHeight: 200 }}>
                        {filteredPlayers.length > 0 ? filteredPlayers.map((player) => {
                            const checked = selectedPlayerIds.includes(String(player._id));
                            return (
                                <label key={player._id} className={`admin-location-option ${checked ? "selected" : ""}`}>
                                    <input type="checkbox" checked={checked} onChange={() => togglePlayer(player._id)} />
                                    <span>
                                        <strong>{player.name}</strong>
                                        {player._isExistingTeamPlayer ? (
                                            <small style={{ color: "#22c55e" }}>Currently on this team</small>
                                        ) : (
                                            <small>Free Agent{player.organization?.name ? ` — ${player.organization.name}` : ""}</small>
                                        )}
                                    </span>
                                </label>
                            );
                        }) : (
                            <div style={{ color: "#8b90a0", fontSize: 13, padding: 8 }}>No matching free agents.</div>
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
    const [freeAgents, setFreeAgents] = useState([]);
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
            const [teamsRes, freeAgentsRes] = await Promise.all([
                fetch("/api/teams"),
                fetch("/api/free-agents"),
            ]);
            const [teamsData, freeAgentsData] = await Promise.all([teamsRes.json(), freeAgentsRes.json()]);

            if (teamsData.success) setTeams(teamsData.data || []);
            else showError(teamsData.error || "Failed to load teams");

            if (freeAgentsData.success) setFreeAgents(freeAgentsData.data || []);
            else showError(freeAgentsData.error || "Failed to load free agents");

            if (effectiveRole === "admin") {
                const orgRes = await fetch("/api/organizations");
                const orgData = await orgRes.json();
                if (orgData.success) setOrganizations(orgData.data || []);
            }
        } catch {
            showError("Failed to load teams and free agents");
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
                            freeAgents={freeAgents}
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
