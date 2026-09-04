"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminLayout, { hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";
import WeekdayDatePicker from "@/components/WeekdayDatePicker";

function LeagueModal({ onClose, onSave, initial, isAdmin, organizations, userOrgId, userOrgName, userOrgSlug }) {
    const { showSuccess, showError } = useToast();
    const [form, setForm] = useState({
        name: initial?.name || "",
        type: initial?.type || "active",
        leagueType: initial?.leagueType || "league",
        allowPlaceholderTeams: initial?.allowPlaceholderTeams || false,
        category: initial?.category || "",
        locations: Array.isArray(initial?.locations)
            ? initial.locations
            : initial?.location
                ? [initial.location]
                : [],
        startDate: initial?.startDate ? new Date(initial.startDate).toISOString().split("T")[0] : "",
        endDate: initial?.endDate ? new Date(initial.endDate).toISOString().split("T")[0] : "",
        image: initial?.image || "",
        showOnSignup: initial?.showOnSignup || false,
        playerFee: initial?.playerFee != null ? String(initial.playerFee) : "",
        teamDeposit: initial?.teamDepositOverridden && initial?.teamDeposit != null ? String(initial.teamDeposit) : "",
    });
    const [selectedOrgId, setSelectedOrgId] = useState(
        initial?.organization?._id || initial?.organization || (isAdmin ? "" : userOrgId)
    );
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [categoryOptions, setCategoryOptions] = useState([]);
    const [venuesByCounty, setVenuesByCounty] = useState([]);
    const [scheduleDays, setScheduleDays] = useState([]);
    const [loadingOrg, setLoadingOrg] = useState(false);

    // Season state
    const [seasons, setSeasons] = useState([]);
    const [selectedSeasonId, setSelectedSeasonId] = useState(
        initial?.season?._id || initial?.season || ""
    );
    const [seasonLocked, setSeasonLocked] = useState(!initial?.seasonOverridden);
    const [loadingSeasons, setLoadingSeasons] = useState(false);

    // Resolve the slug for the selected org
    const selectedOrgSlug = isAdmin
        ? organizations.find((o) => o._id === selectedOrgId)?.slug
        : userOrgSlug;

    // Load org data (categories + venues) when org changes
    useEffect(() => {
        if (!selectedOrgSlug) {
            setCategoryOptions([]);
            setVenuesByCounty([]);
            return;
        }
        let cancelled = false;
        setLoadingOrg(true);

        Promise.all([
            fetch(`/api/organizations/${selectedOrgSlug}`).then((r) => r.json()),
            fetch("/api/locations").then((r) => r.json()),
        ])
            .then(([orgRes, venueRes]) => {
                if (cancelled) return;
                const org = orgRes.success ? orgRes.data : null;
                const allVenues = venueRes.success ? venueRes.data || [] : [];

                if (org) {
                    setCategoryOptions(
                        (org.categories || []).map((e) => String(e).trim()).filter(Boolean)
                    );
                    setScheduleDays(org.scheduleDays || []);

                    const groups = (org.locations || []).reduce((acc, loc) => {
                        const key = `${loc.countyName}|${loc.stateAbbr}`;
                        const venues = allVenues.filter(
                            (v) => v.countyName === loc.countyName && v.stateAbbr === loc.stateAbbr
                        );
                        const label = `${loc.countyName || ""} (${loc.stateAbbr || loc.stateName || ""})`.trim();
                        if (!acc.some((g) => g.countyId === key)) {
                            acc.push({ countyId: key, countyLabel: label, venues });
                        }
                        return acc;
                    }, []);
                    setVenuesByCounty(groups);

                    // Remove stale venue names that no longer exist in the DB
                    const validVenueNames = new Set(groups.flatMap((g) => g.venues.map((v) => v.name)));
                    setForm((prev) => {
                        const filtered = prev.locations.filter((n) => validVenueNames.has(n));
                        if (filtered.length !== prev.locations.length) {
                            return { ...prev, locations: filtered };
                        }
                        return prev;
                    });
                }
            })
            .catch(() => {})
            .finally(() => {
                if (!cancelled) setLoadingOrg(false);
            });

        return () => { cancelled = true; };
    }, [selectedOrgSlug]);

    // Fetch seasons when org changes
    useEffect(() => {
        if (!selectedOrgId) {
            setSeasons([]);
            setSelectedSeasonId("");
            return;
        }
        let cancelled = false;
        setLoadingSeasons(true);

        fetch(`/api/seasons?organization=${selectedOrgId}`)
            .then((r) => r.json())
            .then((data) => {
                if (cancelled) return;
                const list = data.success ? data.data : [];
                setSeasons(list);

                // Auto-select default season (only for new leagues or when org changes)
                if (!initial) {
                    const defaultSeason = list.find((s) => s.isDefault);
                    setSelectedSeasonId(defaultSeason?._id || (list.length > 0 ? list[0]._id : ""));
                    setSeasonLocked(true);
                }
            })
            .catch(() => { if (!cancelled) setSeasons([]); })
            .finally(() => { if (!cancelled) setLoadingSeasons(false); });

        return () => { cancelled = true; };
    }, [selectedOrgId]);

    const handleSeasonUnlock = async () => {
        setSeasonLocked(false);
        // Notification to admin deactivated for now
        // TODO: Re-enable admin notification when needed
        /*
        try {
            const orgName = isAdmin
                ? organizations.find((o) => o._id === selectedOrgId)?.name
                : userOrgName;
            const seasonName = seasons.find((s) => s._id === selectedSeasonId)?.name || "Unknown";

            await fetch("/api/notifications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "season_override",
                    message: `Season override: "${orgName}" organizer changed the default season "${seasonName}" while ${initial ? "editing" : "creating"} a league.`,
                    organization: selectedOrgId,
                    meta: {
                        leagueName: form.name || "(untitled)",
                        previousSeasonId: selectedSeasonId,
                        previousSeasonName: seasonName,
                    },
                }),
            });
        } catch {}
        */
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            // A file over the server's upload limit never reaches our API route at
            // all — nginx rejects it with a raw 413 HTML page, not JSON, so calling
            // res.json() on it throws. This used to fail completely silently here
            // (empty catch, no error shown) — now it tells the admin why.
            if (res.status === 413) { showError("Upload size limit exceeded. Maximum file size is 1MB."); return; }
            const data = await res.json();
            if (data.success) setForm(prev => ({ ...prev, image: data.url }));
            else showError(data.error || "Upload failed");
        } catch { showError("Upload failed"); }
        finally { setUploading(false); }
    };

    const toggleVenue = (venueName) => {
        setForm((prev) => ({
            ...prev,
            locations: prev.locations.includes(venueName)
                ? prev.locations.filter((v) => v !== venueName)
                : [...prev.locations, venueName],
        }));
    };

    const handleSave = async () => {
        if (form.playerFee === "" || Number(form.playerFee) < 0) {
            showError("Free agent / player fee is required.");
            return;
        }
        setSaving(true);
        await onSave({
            ...form,
            organization: selectedOrgId,
            season: selectedSeasonId || undefined,
            seasonOverridden: !seasonLocked,
        });
        setSaving(false);
    };

    const hasVenues = venuesByCounty.some((g) => g.venues.length > 0);

    return (
        <div className="admin-modal-backdrop">
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                <button className="admin-modal-close" onClick={onClose} aria-label="Close">
                    <i className="fa-solid fa-xmark"></i>
                </button>
                <h3 className="admin-modal-title">{initial ? "Edit League" : "Add League"}</h3>

                {/* Organization */}
                {!initial && (
                    <div className="admin-form-group">
                        <label className="admin-form-label">Organization *</label>
                        {isAdmin ? (
                            <select
                                className="admin-form-select"
                                value={selectedOrgId}
                                onChange={(e) => {
                                    setSelectedOrgId(e.target.value);
                                    setForm((f) => ({ ...f, category: "", locations: [] }));
                                }}
                            >
                                <option value="">Select organization...</option>
                                {organizations.map((o) => (
                                    <option key={o._id} value={o._id}>{o.name}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                className="admin-form-input"
                                value={userOrgName}
                                disabled
                                style={{ background: "#f3f4f6", color: "#6b7280", cursor: "not-allowed" }}
                            />
                        )}
                    </div>
                )}

                {/* Season */}
                <div className="admin-form-group">
                    <label className="admin-form-label">Season *</label>
                    {loadingSeasons ? (
                        <div style={{ color: "#8b90a0", fontSize: 13 }}>Loading seasons...</div>
                    ) : !selectedOrgId ? (
                        <div style={{ color: "#8b90a0", fontSize: 13 }}>Select an organization first.</div>
                    ) : seasons.length === 0 ? (
                        <div style={{ color: "#8b90a0", fontSize: 13 }}>No seasons found for this organization.</div>
                    ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <select
                                className="admin-form-select"
                                value={selectedSeasonId}
                                onChange={(e) => setSelectedSeasonId(e.target.value)}
                                disabled={seasonLocked}
                                style={seasonLocked ? { background: "#f3f4f6", color: "#6b7280", cursor: "not-allowed", flex: 1 } : { flex: 1 }}
                            >
                                <option value="">Select season...</option>
                                {seasons.map((s) => (
                                    <option key={s._id} value={s._id}>
                                        {s.name}{s.isDefault ? " (Default)" : ""}
                                    </option>
                                ))}
                            </select>
                            {seasonLocked && (
                                <button
                                    type="button"
                                    className="admin-btn admin-btn-ghost admin-btn-sm"
                                    onClick={handleSeasonUnlock}
                                    title="Override default season"
                                    style={{ flexShrink: 0 }}
                                >
                                    <i className="fa-solid fa-pen"></i>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">Name *</label>
                    <input
                        className="admin-form-input"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. Spring 2026"
                    />
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">League Image</label>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {form.image && (
                            <img src={form.image} alt="League" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, border: "1px solid #333" }} />
                        )}
                        <label className="admin-btn admin-btn-ghost admin-btn-sm" style={{ cursor: "pointer", margin: 0 }}>
                            {uploading ? "Uploading..." : form.image ? "Change Image" : "Upload Image"}
                            <input type="file" accept="image/*" onChange={handleImageUpload} hidden disabled={uploading} />
                        </label>
                        {form.image && (
                            <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => setForm(prev => ({ ...prev, image: "" }))} style={{ color: "#ef4444" }}>Remove</button>
                        )}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#dc2626" }}>Max file size: 1MB</div>
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">League Type *</label>
                    <select
                        className="admin-form-select"
                        value={form.leagueType}
                        onChange={(e) => setForm({ ...form, leagueType: e.target.value })}
                    >
                        <option value="league">League</option>
                        <option value="playoffs">Playoffs</option>
                    </select>
                </div>

                <div className="admin-form-group">
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <input
                            type="checkbox"
                            checked={form.allowPlaceholderTeams}
                            onChange={(e) => setForm({ ...form, allowPlaceholderTeams: e.target.checked })}
                        />
                        <span className="admin-form-label" style={{ margin: 0 }}>
                            Include placeholder teams (TBD, Winner, Losers, etc.) in this league&apos;s team dropdown
                        </span>
                    </label>
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">Status</label>
                    <select
                        className="admin-form-select"
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                    >
                        <option value="active">Active</option>
                        <option value="past">Past</option>
                    </select>
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">Category</label>
                    {loadingOrg ? (
                        <div style={{ color: "#8b90a0", fontSize: 13 }}>Loading...</div>
                    ) : categoryOptions.length === 0 ? (
                        <div style={{ color: "#8b90a0", fontSize: 13 }}>
                            {selectedOrgId ? "No categories configured for this organization." : "Select an organization first."}
                        </div>
                    ) : (
                        <select
                            className="admin-form-select"
                            value={form.category}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                        >
                            <option value="">Select category</option>
                            {categoryOptions.map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">Venues</label>
                    {loadingOrg ? (
                        <div style={{ color: "#8b90a0", fontSize: 13 }}>Loading venues...</div>
                    ) : (
                        <div className="admin-location-list" style={{ maxHeight: 220 }}>
                            {!selectedOrgId ? (
                                <div style={{ color: "#8b90a0", fontSize: 13 }}>Select an organization first.</div>
                            ) : !hasVenues ? (
                                <div style={{ color: "#8b90a0", fontSize: 13 }}>
                                    No venues found for this organization&apos;s operating locations.
                                </div>
                            ) : (
                                venuesByCounty.map((group) =>
                                    group.venues.length > 0 && (
                                        <div key={group.countyId}>
                                            <div style={{
                                                fontSize: 11,
                                                fontWeight: 700,
                                                color: "#8b90a0",
                                                textTransform: "uppercase",
                                                letterSpacing: 0.5,
                                                padding: "8px 4px 4px",
                                            }}>
                                                {group.countyLabel}
                                            </div>
                                            {group.venues.map((venue) => {
                                                const checked = form.locations.includes(venue.name);
                                                return (
                                                    <label
                                                        key={venue._id}
                                                        className={`admin-location-option ${checked ? "selected" : ""}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleVenue(venue.name)}
                                                        />
                                                        <span>
                                                            {venue.name}
                                                            {venue.address && <small>{venue.address}</small>}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )
                                )
                            )}
                        </div>
                    )}
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                        <label className="admin-form-label">Start Date</label>
                        <WeekdayDatePicker
                            value={form.startDate}
                            onChange={(d) => setForm({ ...form, startDate: d })}
                            allowedDays={scheduleDays}
                            placeholder="Select start date…"
                        />
                    </div>
                    <div className="admin-form-group" style={{ flex: 1 }}>
                        <label className="admin-form-label">End Date</label>
                        <WeekdayDatePicker
                            value={form.endDate}
                            onChange={(d) => setForm({ ...form, endDate: d })}
                            allowedDays={scheduleDays}
                            placeholder="Select end date…"
                            align="right"
                        />
                    </div>
                </div>

                <div className="admin-form-group">
                    <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                        <input
                            type="checkbox"
                            checked={form.showOnSignup}
                            onChange={(e) => setForm({ ...form, showOnSignup: e.target.checked })}
                        />
                        <span className="admin-form-label" style={{ margin: 0 }}>
                            Show this league on the sign up page
                        </span>
                    </label>
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label" style={{ marginBottom: 4, display: "block" }}>Pricing</label>
                    <div style={{ fontSize: 12, color: "#8b90a0", marginBottom: 8 }}>
                        Team deposit defaults to 4x the player fee unless set explicitly.
                    </div>
                    <div style={{ display: "flex", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                            <label className="admin-form-label">Free Agent / Player Fee *</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="admin-form-input"
                                value={form.playerFee}
                                onChange={(e) => setForm({ ...form, playerFee: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="admin-form-label">Team Deposit</label>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                className="admin-form-input"
                                value={form.teamDeposit}
                                onChange={(e) => setForm({ ...form, teamDeposit: e.target.value })}
                                placeholder={form.playerFee ? `Auto: ${(Number(form.playerFee) * 4).toFixed(2)}` : "Auto: 4x player fee"}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? "Saving..." : initial ? "Save Changes" : "Create League"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function LeagueTeamsModal({ league, onClose }) {
    const { showSuccess, showError } = useToast();

    const [assigned, setAssigned] = useState([]);
    const [orgTeams, setOrgTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTeamIds, setSelectedTeamIds] = useState([]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const pickerRef = useRef(null);
    const [division, setDivision] = useState("");
    const [seedNumber, setSeedNumber] = useState("");
    const [newTeamName, setNewTeamName] = useState("");
    const [newTeamSeedNumber, setNewTeamSeedNumber] = useState("");
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState("");
    const [editSeedValue, setEditSeedValue] = useState("");

    const orgId = league.organization?._id || league.organization;
    const isPlayoffs = league.leagueType === "playoffs";

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [assignedRes, teamsRes] = await Promise.all([
                fetch(`/api/leagues/${league._id}/teams`).then((r) => r.json()),
                fetch(`/api/teams?organization=${orgId}`).then((r) => r.json()),
            ]);
            if (assignedRes.success) setAssigned(assignedRes.data);
            if (teamsRes.success) setOrgTeams(teamsRes.data.filter((t) => !t.isPlaceholder));
        } catch {
            showError("Failed to load teams");
        } finally {
            setLoading(false);
        }
    }, [league._id, orgId, showError]);

    useEffect(() => { load(); }, [load]);

    // Close the team picker when clicking outside it
    useEffect(() => {
        if (!pickerOpen) return;
        const handleClickOutside = (e) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [pickerOpen]);

    const assignedIds = new Set(assigned.map((t) => String(t._id)));
    const availableToAdd = orgTeams.filter((t) => !assignedIds.has(String(t._id)));
    const existingDivisions = [...new Set(assigned.map((t) => t.division).filter(Boolean))];

    const handleAssignExisting = async () => {
        if (selectedTeamIds.length === 0) return;
        setSaving(true);
        // Seed numbers are per-team, so only apply the single Seed # field when
        // exactly one team is selected — with several teams selected there's no
        // one number that makes sense for all of them.
        const applySeed = isPlayoffs && selectedTeamIds.length === 1;
        try {
            const results = await Promise.allSettled(
                selectedTeamIds.map((teamId) =>
                    fetch(`/api/leagues/${league._id}/teams`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            teamId,
                            division: division.trim(),
                            ...(applySeed ? { seedNumber: seedNumber === "" ? null : seedNumber } : {}),
                        }),
                    }).then((r) => r.json())
                )
            );

            let successCount = 0;
            const failures = [];
            results.forEach((result, i) => {
                if (result.status === "fulfilled" && result.value.success) {
                    successCount++;
                } else {
                    const teamName = availableToAdd.find((t) => t._id === selectedTeamIds[i])?.name || "Team";
                    const reason = result.status === "fulfilled" ? result.value.error : "Request failed";
                    failures.push(`${teamName}: ${reason}`);
                }
            });

            if (successCount > 0) {
                showSuccess(successCount === 1 ? "Team assigned!" : `${successCount} teams assigned!`);
            }
            if (failures.length > 0) {
                showError(failures.join(" · "));
            }

            setSelectedTeamIds([]);
            setDivision("");
            setSeedNumber("");
            load();
        } catch {
            showError("Failed to assign teams");
        } finally {
            setSaving(false);
        }
    };

    const handleCreateAndAssign = async () => {
        if (!newTeamName.trim()) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/leagues/${league._id}/teams`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newTeamName.trim(),
                    division: division.trim(),
                    ...(isPlayoffs ? { seedNumber: newTeamSeedNumber === "" ? null : newTeamSeedNumber } : {}),
                }),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            showSuccess("Team created and assigned!");
            setNewTeamName("");
            setDivision("");
            setNewTeamSeedNumber("");
            load();
        } catch {
            showError("Failed to create team");
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (team) => {
        setEditingId(team._id);
        setEditValue(team.division || "");
        setEditSeedValue(team.seedNumber === null || team.seedNumber === undefined ? "" : String(team.seedNumber));
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditValue("");
        setEditSeedValue("");
    };

    const handleSaveEdit = async (team) => {
        setSaving(true);
        try {
            const res = await fetch(`/api/leagues/${league._id}/teams/${team._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    division: editValue.trim(),
                    ...(isPlayoffs ? { seedNumber: editSeedValue === "" ? null : editSeedValue } : {}),
                }),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            showSuccess("Team membership updated!");
            cancelEdit();
            load();
        } catch {
            showError("Failed to update team membership");
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (team) => {
        if (!confirm(`Remove "${team.name}" from this league?`)) return;
        try {
            const res = await fetch(`/api/leagues/${league._id}/teams/${team._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            showSuccess("Team removed from league");
            load();
        } catch {
            showError("Failed to remove team");
        }
    };

    return (
        <div className="admin-modal-backdrop">
            <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
                <button className="admin-modal-close" onClick={onClose} aria-label="Close">
                    <i className="fa-solid fa-xmark"></i>
                </button>
                <h3 className="admin-modal-title">Manage Teams — {league.name}</h3>

                {loading ? (
                    <div className="admin-loading"><div className="admin-spinner"></div>Loading teams...</div>
                ) : (
                    <>
                        <div className="admin-form-group">
                            <label className="admin-form-label">Currently Assigned ({assigned.length})</label>
                            {assigned.length === 0 ? (
                                <div style={{ color: "#8b90a0", fontSize: 13 }}>No teams assigned yet.</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {assigned.map((t) => (
                                        <div key={t._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "#f9fafb", border: "1px solid #e8eaef", borderRadius: 6, gap: 8 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                                                {t.logo && <img src={t.logo} alt="" style={{ width: 20, height: 20, borderRadius: 4, flexShrink: 0 }} />}
                                                <span style={{ fontWeight: 600, fontSize: 13, color: "#1a1d26", flexShrink: 0 }}>{t.name}</span>
                                                {editingId === t._id ? (
                                                    <>
                                                        <input
                                                            className="admin-form-input"
                                                            style={{ flex: 1, height: 30, fontSize: 12, padding: "4px 8px" }}
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            placeholder="Division"
                                                            autoFocus
                                                        />
                                                        {isPlayoffs && (
                                                            <input
                                                                type="number"
                                                                className="admin-form-input"
                                                                style={{ width: 70, height: 30, fontSize: 12, padding: "4px 8px", flexShrink: 0 }}
                                                                value={editSeedValue}
                                                                onChange={(e) => setEditSeedValue(e.target.value)}
                                                                placeholder="Seed #"
                                                            />
                                                        )}
                                                    </>
                                                ) : (
                                                    <>
                                                        {t.division && <span style={{ color: "#8b90a0", fontSize: 12 }}>({t.division})</span>}
                                                        {isPlayoffs && t.seedNumber !== null && t.seedNumber !== undefined && (
                                                            <span style={{ color: "#fff", background: "#8b90a0", fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 10, flexShrink: 0 }}>#{t.seedNumber}</span>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                            {editingId === t._id ? (
                                                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                                    <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => handleSaveEdit(t)} disabled={saving} title="Save">
                                                        <i className="fa-solid fa-check"></i>
                                                    </button>
                                                    <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={cancelEdit} disabled={saving} title="Cancel">
                                                        <i className="fa-solid fa-xmark"></i>
                                                    </button>
                                                </div>
                                            ) : (
                                                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                                    <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => startEdit(t)} title={isPlayoffs ? "Edit division / seed" : "Edit division"}>
                                                        <i className="fa-solid fa-pen"></i>
                                                    </button>
                                                    <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleRemove(t)} title="Remove">
                                                        <i className="fa-solid fa-xmark"></i>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="admin-form-group">
                            <label className="admin-form-label">Division (applies to whichever action below you use)</label>
                            <input
                                className="admin-form-input"
                                value={division}
                                onChange={(e) => setDivision(e.target.value)}
                                placeholder="e.g. East, West, Default"
                                list="leagueTeamsDivisionOptions"
                            />
                            {existingDivisions.length > 0 && (
                                <datalist id="leagueTeamsDivisionOptions">
                                    {existingDivisions.map((d) => <option key={d} value={d} />)}
                                </datalist>
                            )}
                        </div>

                        <div className="admin-form-group">
                            <label className="admin-form-label">Assign Existing Team(s)</label>
                            <div style={{ display: "flex", gap: 8 }}>
                                <div ref={pickerRef} style={{ position: "relative", flex: 1 }}>
                                    <div
                                        className="admin-form-select"
                                        style={{
                                            display: "flex", alignItems: "center", justifyContent: "space-between",
                                            cursor: availableToAdd.length === 0 ? "not-allowed" : "pointer",
                                            userSelect: "none",
                                        }}
                                        onClick={() => availableToAdd.length > 0 && setPickerOpen((o) => !o)}
                                    >
                                        <span style={{ color: selectedTeamIds.length === 0 ? "#8b90a0" : "#1a1d26", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {availableToAdd.length === 0
                                                ? "No other teams in this organization"
                                                : selectedTeamIds.length === 0
                                                ? "Select team(s)..."
                                                : selectedTeamIds.length === 1
                                                ? availableToAdd.find((t) => t._id === selectedTeamIds[0])?.name || "1 team selected"
                                                : `${selectedTeamIds.length} teams selected`}
                                        </span>
                                        <i className={`fa-solid fa-chevron-${pickerOpen ? "up" : "down"}`} style={{ fontSize: 11, color: "#8b90a0", flexShrink: 0, marginLeft: 8 }}></i>
                                    </div>
                                    {pickerOpen && availableToAdd.length > 0 && (
                                        <div style={{
                                            position: "absolute", bottom: "calc(100% + 4px)", left: 0, right: 0, zIndex: 30,
                                            background: "#fff", border: "1px solid #d5d8e0", borderRadius: 8,
                                            maxHeight: 280, overflowY: "auto", boxShadow: "0 -8px 24px rgba(0,0,0,0.12)",
                                        }}>
                                            {availableToAdd.map((t) => {
                                                const checked = selectedTeamIds.includes(t._id);
                                                return (
                                                    <label
                                                        key={t._id}
                                                        style={{
                                                            display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
                                                            fontSize: 13, color: "#1a1d26", cursor: "pointer",
                                                            borderBottom: "1px solid #f1f2f5",
                                                            background: checked ? "#fff5f4" : "#fff",
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => setSelectedTeamIds((prev) =>
                                                                checked ? prev.filter((id) => id !== t._id) : [...prev, t._id]
                                                            )}
                                                            style={{ flexShrink: 0 }}
                                                        />
                                                        <span>{t.name}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                {isPlayoffs && selectedTeamIds.length === 1 && (
                                    <input
                                        type="number"
                                        className="admin-form-input"
                                        style={{ width: 80, flexShrink: 0 }}
                                        value={seedNumber}
                                        onChange={(e) => setSeedNumber(e.target.value)}
                                        placeholder="Seed #"
                                        title="Playoff seed number — only applies to this league"
                                    />
                                )}
                                <button className="admin-btn admin-btn-primary" style={{ flexShrink: 0 }} onClick={handleAssignExisting} disabled={saving || selectedTeamIds.length === 0}>
                                    {selectedTeamIds.length > 1 ? `Assign (${selectedTeamIds.length})` : "Assign"}
                                </button>
                            </div>
                            {selectedTeamIds.length > 0 && (
                                <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                                    {selectedTeamIds.map((id) => {
                                        const t = availableToAdd.find((team) => team._id === id);
                                        if (!t) return null;
                                        return (
                                            <span
                                                key={id}
                                                style={{
                                                    display: "inline-flex", alignItems: "center", gap: 6,
                                                    background: "#fff5f4", border: "1px solid #ffd6d1", color: "#1a1d26",
                                                    borderRadius: 20, padding: "4px 6px 4px 10px", fontSize: 12, fontWeight: 500,
                                                }}
                                            >
                                                {t.name}
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedTeamIds((prev) => prev.filter((tid) => tid !== id))}
                                                    aria-label={`Remove ${t.name}`}
                                                    style={{
                                                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                        width: 16, height: 16, borderRadius: "50%", border: "none",
                                                        background: "rgba(220,38,38,0.12)", color: "#dc2626", cursor: "pointer",
                                                        fontSize: 10, lineHeight: 1, padding: 0,
                                                    }}
                                                >
                                                    <i className="fa-solid fa-xmark"></i>
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                            {selectedTeamIds.length > 1 && (
                                <div style={{ marginTop: 6, fontSize: 12, color: "#8b90a0" }}>
                                    <i className="fa-solid fa-circle-info" style={{ marginRight: 4 }}></i>
                                    The division above will be applied to all {selectedTeamIds.length} selected teams.
                                </div>
                            )}
                        </div>

                        <div className="admin-form-group">
                            <label className="admin-form-label">Or Create a New Team</label>
                            <div style={{ display: "flex", gap: 8 }}>
                                <input
                                    className="admin-form-input"
                                    style={{ flex: 1 }}
                                    value={newTeamName}
                                    onChange={(e) => setNewTeamName(e.target.value)}
                                    placeholder="e.g. Eagles"
                                />
                                {isPlayoffs && (
                                    <input
                                        type="number"
                                        className="admin-form-input"
                                        style={{ width: 80, flexShrink: 0 }}
                                        value={newTeamSeedNumber}
                                        onChange={(e) => setNewTeamSeedNumber(e.target.value)}
                                        placeholder="Seed #"
                                        title="Playoff seed number — only applies to this league"
                                    />
                                )}
                                <button className="admin-btn admin-btn-ghost" onClick={handleCreateAndAssign} disabled={saving || !newTeamName.trim()}>
                                    Create &amp; Assign
                                </button>
                            </div>
                        </div>
                    </>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}

function PlaceholderTeamsModal({ onClose, isAdmin, organizations, userOrgId }) {
    const { showSuccess, showError } = useToast();
    const [selectedOrgId, setSelectedOrgId] = useState(isAdmin ? "" : userOrgId);
    const [placeholders, setPlaceholders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editLogo, setEditLogo] = useState("");
    const [editUploading, setEditUploading] = useState(false);
    const [newName, setNewName] = useState("");
    const [newLogo, setNewLogo] = useState("");
    const [newUploading, setNewUploading] = useState(false);

    const load = useCallback(async (orgId) => {
        if (!orgId) { setPlaceholders([]); return; }
        setLoading(true);
        try {
            const res = await fetch(`/api/placeholder-teams?organization=${orgId}`);
            const data = await res.json();
            if (data.success) setPlaceholders(data.data);
            else showError(data.error || "Failed to load placeholders");
        } catch { showError("Failed to load placeholders"); }
        finally { setLoading(false); }
    }, [showError]);

    useEffect(() => { load(selectedOrgId); }, [selectedOrgId, load]);

    const handleUpload = async (file, setter, setUploadingFlag) => {
        if (!file) return;
        setUploadingFlag(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            // A file over the server's upload limit never reaches our API route at
            // all — nginx rejects it with a raw 413 HTML page, not JSON, so calling
            // res.json() on it throws and used to fall through to a generic
            // "Upload failed" toast. Catch that case by status before parsing.
            if (res.status === 413) { showError("Upload size limit exceeded. Maximum file size is 1MB."); return; }
            const data = await res.json();
            if (data.success) setter(data.url);
            else showError(data.error || "Upload failed");
        } catch { showError("Upload failed"); }
        finally { setUploadingFlag(false); }
    };

    const startEdit = (p) => {
        setEditingId(p._id);
        setEditName(p.name);
        setEditLogo(p.logo || "");
    };
    const cancelEdit = () => { setEditingId(null); setEditName(""); setEditLogo(""); };

    const saveEdit = async () => {
        if (!editName.trim()) { showError("Name is required"); return; }
        setSaving(true);
        try {
            const res = await fetch(`/api/placeholder-teams/${editingId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editName.trim(), logo: editLogo }),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            showSuccess("Placeholder updated!");
            cancelEdit();
            load(selectedOrgId);
        } catch { showError("Failed to update placeholder"); }
        finally { setSaving(false); }
    };

    const handleDelete = async (p) => {
        if (!confirm(`Delete placeholder "${p.name}"? Any schedule already using it will show a missing team.`)) return;
        try {
            const res = await fetch(`/api/placeholder-teams/${p._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            showSuccess("Placeholder deleted");
            load(selectedOrgId);
        } catch { showError("Failed to delete placeholder"); }
    };

    const handleAdd = async () => {
        if (!newName.trim()) { showError("Name is required"); return; }
        setSaving(true);
        try {
            const res = await fetch("/api/placeholder-teams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName.trim(), logo: newLogo, organization: selectedOrgId }),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            showSuccess("Placeholder added!");
            setNewName("");
            setNewLogo("");
            load(selectedOrgId);
        } catch { showError("Failed to add placeholder"); }
        finally { setSaving(false); }
    };

    return (
        <div className="admin-modal-backdrop">
            <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: "90vh", overflowY: "auto" }}>
                <button className="admin-modal-close" onClick={onClose} aria-label="Close">
                    <i className="fa-solid fa-xmark"></i>
                </button>
                <h3 className="admin-modal-title">Manage Placeholders</h3>
                <p style={{ color: "#8b90a0", fontSize: 13, marginTop: -8, marginBottom: 16 }}>
                    Placeholders (TBD, Winner, Losers, bracket slots) fill schedule matchups before the real team is decided.
                </p>

                {isAdmin && (
                    <div className="admin-form-group">
                        <label className="admin-form-label">Organization *</label>
                        <select className="admin-form-select" value={selectedOrgId} onChange={(e) => setSelectedOrgId(e.target.value)}>
                            <option value="">Select organization...</option>
                            {organizations.map((o) => (
                                <option key={o._id} value={o._id}>{o.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                {!selectedOrgId ? (
                    <div style={{ color: "#8b90a0", fontSize: 13 }}>
                        {isAdmin ? "Select an organization to manage its placeholders." : "No organization found."}
                    </div>
                ) : loading ? (
                    <div className="admin-loading"><div className="admin-spinner"></div>Loading placeholders...</div>
                ) : (
                    <>
                        <div className="admin-form-group">
                            <label className="admin-form-label">Existing Placeholders ({placeholders.length})</label>
                            {placeholders.length === 0 ? (
                                <div style={{ color: "#8b90a0", fontSize: 13 }}>No placeholders yet.</div>
                            ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {placeholders.map((p) => (
                                        <div key={p._id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "#f9fafb", border: "1px solid #e8eaef", borderRadius: 6, gap: 8 }}>
                                            {editingId === p._id ? (
                                                <>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                                                        {editLogo ? (
                                                            <img src={editLogo} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                                                        ) : (
                                                            <div style={{ width: 28, height: 28, borderRadius: 6, background: "#e5e7ef", flexShrink: 0 }} />
                                                        )}
                                                        <input
                                                            className="admin-form-input"
                                                            style={{ flex: 1, height: 30, fontSize: 12, padding: "4px 8px" }}
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            autoFocus
                                                        />
                                                        <label className="admin-btn admin-btn-ghost admin-btn-sm" style={{ cursor: "pointer", margin: 0, flexShrink: 0 }} title="Change image (max 1MB)">
                                                            {editUploading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-image"></i>}
                                                            <input type="file" accept="image/*" hidden disabled={editUploading}
                                                                onChange={(e) => handleUpload(e.target.files?.[0], setEditLogo, setEditUploading)} />
                                                        </label>
                                                        {editLogo && (
                                                            <button
                                                                type="button"
                                                                className="admin-btn admin-btn-ghost admin-btn-sm"
                                                                style={{ flexShrink: 0, color: "#ef4444" }}
                                                                title="Remove image"
                                                                onClick={() => setEditLogo("")}
                                                            >
                                                                <i className="fa-solid fa-trash"></i>
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                                        <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={saveEdit} disabled={saving} title="Save">
                                                            <i className="fa-solid fa-check"></i>
                                                        </button>
                                                        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={cancelEdit} disabled={saving} title="Cancel">
                                                            <i className="fa-solid fa-xmark"></i>
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
                                                        {p.logo ? (
                                                            <img src={p.logo} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                                                        ) : (
                                                            <div style={{ width: 28, height: 28, borderRadius: 6, background: "#e5e7ef", flexShrink: 0 }} />
                                                        )}
                                                        <span style={{ fontWeight: 600, fontSize: 13, color: "#1a1d26" }}>{p.name}</span>
                                                    </div>
                                                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                                        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => startEdit(p)} title="Edit">
                                                            <i className="fa-solid fa-pen"></i>
                                                        </button>
                                                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(p)} title="Delete">
                                                            <i className="fa-solid fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="admin-form-group">
                            <label className="admin-form-label">Add a New Placeholder</label>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                {newLogo ? (
                                    <img src={newLogo} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                                ) : (
                                    <div style={{ width: 32, height: 32, borderRadius: 6, background: "#e5e7ef", flexShrink: 0 }} />
                                )}
                                <input
                                    className="admin-form-input"
                                    style={{ flex: 1 }}
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="e.g. Wildcard, D5 Championship"
                                />
                                <label className="admin-btn admin-btn-ghost admin-btn-sm" style={{ cursor: "pointer", margin: 0, flexShrink: 0 }}>
                                    {newUploading ? "Uploading..." : "Image"}
                                    <input type="file" accept="image/*" hidden disabled={newUploading}
                                        onChange={(e) => handleUpload(e.target.files?.[0], setNewLogo, setNewUploading)} />
                                </label>
                                {newLogo && (
                                    <button
                                        type="button"
                                        className="admin-btn admin-btn-ghost admin-btn-sm"
                                        style={{ flexShrink: 0, color: "#ef4444" }}
                                        title="Remove image"
                                        onClick={() => setNewLogo("")}
                                    >
                                        <i className="fa-solid fa-trash"></i>
                                    </button>
                                )}
                                <button className="admin-btn admin-btn-primary" onClick={handleAdd} disabled={saving || !newName.trim()}>
                                    Add
                                </button>
                            </div>
                            <div style={{ marginTop: 6, fontSize: 12, color: "#dc2626" }}>Max file size: 1MB</div>
                        </div>
                    </>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
}

export default function LeaguesPage() {
    const { user, activeRole } = useAuth();
    const { showSuccess, showError } = useToast();

    const [leagues, setLeagues] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [teamsTarget, setTeamsTarget] = useState(null);
    const [showPlaceholdersModal, setShowPlaceholdersModal] = useState(false);

    // Sort
    const [sortField, setSortField] = useState("name"); // "name" | "startDate" | "endDate"
    const [sortDir, setSortDir] = useState("asc"); // "asc" | "desc"

    // Filters
    const [allStatesRaw, setAllStatesRaw] = useState([]);
    const [allVenuesRaw, setAllVenuesRaw] = useState([]);
    // County+state combos the current organizer's org actually operates in
    // (from Organization.locations) — null means "not scoped" (admin, or
    // not loaded yet), so state/venue filters fall back to the full list.
    const [orgLocationKeys, setOrgLocationKeys] = useState(null);
    const [filterState, setFilterState] = useState("");
    const [filterCounty, setFilterCounty] = useState("");
    const [filterCity, setFilterCity] = useState("");
    const [filterLocation, setFilterLocation] = useState("");

    const isAdmin = user?.role === "admin";
    const effectiveRole = activeRole || user?.role;
    const organizerOrg = user?.roleOrganizations?.[effectiveRole] || user?.organization;
    const userOrgId = organizerOrg?.id || organizerOrg?._id || "";
    const userOrgName = organizerOrg?.name || "";
    const userOrgSlug = organizerOrg?.slug || "";

    const canView = hasAnyAccess(user, ["manage_leagues", "league_view", "league_create", "league_update", "league_delete"]);
    const canCreate = hasAnyAccess(user, ["manage_leagues", "league_create"]);
    const canUpdate = hasAnyAccess(user, ["manage_leagues", "league_update"]);
    const canDelete = hasAnyAccess(user, ["manage_leagues", "league_delete"]);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    // Fetch organizations (admin only)
    useEffect(() => {
        if (!isAdmin) return;
        fetch("/api/organizations")
            .then((r) => r.json())
            .then((d) => { if (d.success) setOrganizations(d.data); })
            .catch(() => {});
    }, [isAdmin]);

    // Fetch states and all venues once for filter dropdowns
    useEffect(() => {
        fetch("/api/states")
            .then((r) => r.json())
            .then((d) => { if (d.success) setAllStatesRaw(d.data || []); })
            .catch(() => {});
        fetch("/api/locations")
            .then((r) => r.json())
            .then((d) => { if (d.success) setAllVenuesRaw(d.data || []); })
            .catch(() => {});
    }, []);

    // Organizers should only filter by the states/counties their own org
    // operates in, not every state in the system — admins keep the full list.
    useEffect(() => {
        if (isAdmin || !userOrgSlug) { setOrgLocationKeys(null); return; }
        let cancelled = false;
        fetch(`/api/organizations/${userOrgSlug}`)
            .then((r) => r.json())
            .then((d) => {
                if (cancelled || !d.success) return;
                const keys = new Set((d.data.locations || []).map((l) => `${l.countyName}|${l.stateAbbr}`));
                setOrgLocationKeys(keys);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [isAdmin, userOrgSlug]);

    const allVenues = orgLocationKeys
        ? allVenuesRaw.filter((v) => orgLocationKeys.has(`${v.countyName}|${v.stateAbbr}`))
        : allVenuesRaw;
    const allStates = orgLocationKeys
        ? allStatesRaw.filter((s) => allVenues.some((v) => v.stateId === s._id))
        : allStatesRaw;

    // Cascading county options based on selected state
    const countyOptions = filterState
        ? [...new Map(
            allVenues
                .filter((v) => v.stateId === filterState)
                .map((v) => [v.countyId, { id: v.countyId, name: v.countyName }])
          ).values()].sort((a, b) => a.name.localeCompare(b.name))
        : [];

    // Cascading city options based on selected state/county
    const cityOptions = filterState
        ? [...new Set(
            allVenues
                .filter((v) => (filterCounty ? v.countyId === filterCounty : v.stateId === filterState) && v.cityName)
                .map((v) => v.cityName)
          )].sort()
        : [];

    // Cascading venue options based on selected city/county/state
    const venueOptions = filterCity
        ? allVenues
            .filter((v) => v.cityName === filterCity && (filterCounty ? v.countyId === filterCounty : v.stateId === filterState))
            .sort((a, b) => a.name.localeCompare(b.name))
        : filterCounty
        ? allVenues.filter((v) => v.countyId === filterCounty).sort((a, b) => a.name.localeCompare(b.name))
        : filterState
        ? allVenues.filter((v) => v.stateId === filterState).sort((a, b) => a.name.localeCompare(b.name))
        : [];

    // Reset county/city/location when state changes
    const handleStateChange = (val) => {
        setFilterState(val);
        setFilterCounty("");
        setFilterCity("");
        setFilterLocation("");
    };
    // Reset city/location when county changes
    const handleCountyChange = (val) => {
        setFilterCounty(val);
        setFilterCity("");
        setFilterLocation("");
    };

    const fetchLeagues = useCallback(async () => {
        if (!canView) { setLoading(false); return; }
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            const res = await fetch(`/api/leagues?${params.toString()}`);
            const data = await res.json();
            if (data.success) setLeagues(data.data);
            else showError(data.error || "Failed to load leagues");
        } catch { showError("Failed to load leagues"); }
        finally { setLoading(false); }
    }, [canView, search, showError]);

    // Build venue-name → stateId/countyId/cityName lookup
    const venueLookup = Object.fromEntries(
        allVenues.map((v) => [v.name, { stateId: v.stateId, countyId: v.countyId, cityName: v.cityName || "" }])
    );

    // Derive filtered + sorted league list
    const displayLeagues = [...leagues]
        .filter((league) => {
            if (!filterState && !filterCounty && !filterCity && !filterLocation) return true;
            const names = Array.isArray(league.locations) && league.locations.length > 0
                ? league.locations
                : league.location ? [league.location] : [];
            return names.some((n) => {
                const v = venueLookup[n];
                if (!v) return false;
                if (filterLocation) return n === filterLocation;
                if (filterCity) return v.cityName === filterCity;
                if (filterCounty) return v.countyId === filterCounty;
                if (filterState) return v.stateId === filterState;
                return true;
            });
        })
        .sort((a, b) => {
            let valA, valB;
            if (sortField === "name") {
                valA = (a.name || "").toLowerCase();
                valB = (b.name || "").toLowerCase();
                return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            if (sortField === "startDate") {
                valA = a.startDate ? new Date(a.startDate).getTime() : 0;
                valB = b.startDate ? new Date(b.startDate).getTime() : 0;
            } else if (sortField === "endDate") {
                valA = a.endDate ? new Date(a.endDate).getTime() : 0;
                valB = b.endDate ? new Date(b.endDate).getTime() : 0;
            }
            return sortDir === "asc" ? valA - valB : valB - valA;
        });

    const toggleSort = (field) => {
        if (sortField === field) {
            setSortDir((d) => d === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDir("asc");
        }
    };

    const SortIcon = ({ field }) => {
        if (sortField !== field) return <i className="fa-solid fa-sort" style={{ marginLeft: 4, opacity: 0.35, fontSize: 11 }}></i>;
        return sortDir === "asc"
            ? <i className="fa-solid fa-sort-up" style={{ marginLeft: 4, fontSize: 11, color: "#e63946" }}></i>
            : <i className="fa-solid fa-sort-down" style={{ marginLeft: 4, fontSize: 11, color: "#e63946" }}></i>;
    };

    useEffect(() => { fetchLeagues(); }, [fetchLeagues]);

    const handleSave = async (formData) => {
        try {
            if (editTarget) {
                if (!canUpdate) { showError("No permission to update leagues."); return; }
                const res = await fetch(`/api/leagues/${editTarget._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error); return; }
                showSuccess("League updated!");
            } else {
                if (!canCreate) { showError("No permission to create leagues."); return; }
                if (!formData.organization) { showError("Please select an organization."); return; }
                const res = await fetch("/api/leagues", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error); return; }
                showSuccess("League created!");
            }
            setShowModal(false);
            setEditTarget(null);
            fetchLeagues();
        } catch { showError("Failed to save league"); }
    };

    const deleteLeague = async (league) => {
        if (!canDelete) { showError("No permission to delete leagues."); return; }
        if (!confirm(`Delete league "${league.name}"? This cannot be undone.`)) return;
        try {
            const res = await fetch(`/api/leagues/${league._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            fetchLeagues();
            showSuccess("League deleted!");
        } catch { showError("Failed to delete league"); }
    };

    return (
        <AdminLayout title="Leagues">
            {!canView ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to view leagues.</p>
                </div>
            ) : (
                <div className="admin-card">
                    <div className="admin-card-header" style={{ flexWrap: "wrap", gap: 10 }}>
                        <h3>Leagues ({displayLeagues.length})</h3>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <input
                                className="admin-form-input"
                                placeholder="Search..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                style={{ width: 200, height: 36, fontSize: 13, minWidth: 120, flex: "1 1 140px" }}
                            />
                            {canUpdate && (
                                <button
                                    className="admin-btn admin-btn-ghost"
                                    onClick={() => setShowPlaceholdersModal(true)}
                                    style={{ flexShrink: 0 }}
                                >
                                    <i className="fa-solid fa-users-viewfinder"></i> Manage Placeholders
                                </button>
                            )}
                            {canCreate && (
                                <button
                                    className="admin-btn admin-btn-primary"
                                    onClick={() => { setEditTarget(null); setShowModal(true); }}
                                    style={{ flexShrink: 0 }}
                                >
                                    <i className="fa-solid fa-plus"></i> Add League
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Filter + Sort bar */}
                    <div className="leagues-filter-bar" style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, padding: "10px 16px 10px", borderBottom: "1px solid #e8eaf0", marginBottom: 4, alignItems: "center" }}>
                        {/* State */}
                        <select
                            className="admin-form-select"
                            value={filterState}
                            onChange={(e) => handleStateChange(e.target.value)}
                            style={{ width: 155, height: 34, fontSize: 13 }}
                        >
                            <option value="">All States</option>
                            {allStates.map((s) => (
                                <option key={s._id} value={s._id}>{s.name}</option>
                            ))}
                        </select>

                        {/* County — only shown once a state is picked */}
                        {filterState && (
                            <select
                                className="admin-form-select"
                                value={filterCounty}
                                onChange={(e) => handleCountyChange(e.target.value)}
                                style={{ width: 155, height: 34, fontSize: 13 }}
                            >
                                <option value="">All Counties</option>
                                {countyOptions.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        )}

                        {/* City — only shown once a state is picked */}
                        {filterState && (
                            <select
                                className="admin-form-select"
                                value={filterCity}
                                onChange={(e) => { setFilterCity(e.target.value); setFilterLocation(""); }}
                                style={{ width: 155, height: 34, fontSize: 13 }}
                            >
                                <option value="">All Cities</option>
                                {cityOptions.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        )}

                        {/* Location — only shown once a state is picked */}
                        {filterState && (
                            <select
                                className="admin-form-select"
                                value={filterLocation}
                                onChange={(e) => setFilterLocation(e.target.value)}
                                style={{ width: 175, height: 34, fontSize: 13 }}
                            >
                                <option value="">All Locations</option>
                                {venueOptions.map((v) => (
                                    <option key={v._id} value={v.name}>{v.name}</option>
                                ))}
                            </select>
                        )}

                        {/* Divider between filters and sort */}
                        <div style={{ width: 1, height: 24, background: "#e0e2ea", margin: "0 4px", flexShrink: 0 }} />

                        {/* Sort */}
                        <select
                            className="admin-form-select"
                            value={`${sortField}:${sortDir}`}
                            onChange={(e) => {
                                const [f, d] = e.target.value.split(":");
                                setSortField(f);
                                setSortDir(d);
                            }}
                            style={{ width: 200, height: 34, fontSize: 13 }}
                        >
                            <option value="name:asc">Name (A → Z)</option>
                            <option value="name:desc">Name (Z → A)</option>
                            <option value="startDate:asc">Start Date (Oldest first)</option>
                            <option value="startDate:desc">Start Date (Newest first)</option>
                            <option value="endDate:asc">End Date (Oldest first)</option>
                            <option value="endDate:desc">End Date (Newest first)</option>
                        </select>

                        {/* Clear filters */}
                        {(filterState || filterCounty || filterCity || filterLocation) && (
                            <button
                                className="admin-btn admin-btn-ghost admin-btn-sm"
                                onClick={() => { setFilterState(""); setFilterCounty(""); setFilterCity(""); setFilterLocation(""); }}
                                style={{ height: 34, whiteSpace: "nowrap" }}
                            >
                                <i className="fa-solid fa-xmark"></i> Clear
                            </button>
                        )}
                    </div>

                    {loading ? (
                        <div className="admin-loading"><div className="admin-spinner"></div>Loading leagues...</div>
                    ) : leagues.length === 0 ? (
                        <div className="admin-empty">
                            <i className="fa-solid fa-trophy"></i>
                            <p>No leagues found.</p>
                        </div>
                    ) : displayLeagues.length === 0 ? (
                        <div className="admin-empty">
                            <i className="fa-solid fa-filter"></i>
                            <p>No leagues match the selected filters.</p>
                        </div>
                    ) : (
                        <>
                            <div className="leagues-table-wrap">
                                <div style={{ overflowX: "auto" }}>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("name")}>
                                                    Name <SortIcon field="name" />
                                                </th>
                                                {isAdmin && <th>Organization</th>}
                                                <th>Season</th>
                                                <th>Status</th>
                                                <th>Category</th>
                                                <th>Location</th>
                                                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("startDate")}>
                                                    Start Date <SortIcon field="startDate" />
                                                </th>
                                                <th style={{ cursor: "pointer", userSelect: "none" }} onClick={() => toggleSort("endDate")}>
                                                    End Date <SortIcon field="endDate" />
                                                </th>
                                                <th style={{ width: 120 }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {displayLeagues.map((league) => (
                                                <tr key={league._id}>
                                                    <td style={{ fontWeight: 600 }}>{league.name}</td>
                                                    {isAdmin && (
                                                        <td style={{ color: "#5a5f72" }}>
                                                            {league.organization?.name || "-"}
                                                        </td>
                                                    )}
                                                    <td style={{ color: "#5a5f72" }}>
                                                        {league.season?.name || "-"}
                                                    </td>
                                                    <td>
                                                        <span className={`admin-badge ${league.type === "active" ? "player" : ""}`}>
                                                            {league.type === "active" ? "Active" : "Past"}
                                                        </span>
                                                    </td>
                                                    <td style={{ color: "#5a5f72" }}>{league.category || "-"}</td>
                                                    <td style={{ color: "#5a5f72" }}>
                                                        {Array.isArray(league.locations) && league.locations.length > 0
                                                            ? league.locations.join(", ")
                                                            : league.location || "-"}
                                                    </td>
                                                    <td style={{ color: "#8b90a0", fontSize: 13 }}>
                                                        {league.startDate
                                                            ? new Date(league.startDate).toLocaleDateString("en-US", { timeZone: "UTC" })
                                                            : "-"}
                                                    </td>
                                                    <td style={{ color: "#8b90a0", fontSize: 13 }}>
                                                        {league.endDate
                                                            ? new Date(league.endDate).toLocaleDateString("en-US", { timeZone: "UTC" })
                                                            : "-"}
                                                    </td>
                                                    <td>
                                                        <div style={{ display: "flex", gap: 6 }}>
                                                            {canUpdate && (
                                                                <button
                                                                    className="admin-btn admin-btn-ghost admin-btn-sm"
                                                                    onClick={() => setTeamsTarget(league)}
                                                                    title="Manage Teams"
                                                                >
                                                                    <i className="fa-solid fa-people-group"></i>
                                                                </button>
                                                            )}
                                                            {canUpdate && (
                                                                <button
                                                                    className="admin-btn admin-btn-ghost admin-btn-sm"
                                                                    onClick={() => { setEditTarget(league); setShowModal(true); }}
                                                                    title="Edit"
                                                                >
                                                                    <i className="fa-solid fa-pen"></i>
                                                                </button>
                                                            )}
                                                            {canDelete && (
                                                                <button
                                                                    className="admin-btn admin-btn-danger admin-btn-sm"
                                                                    onClick={() => deleteLeague(league)}
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
                            </div>

                            <div className="leagues-card-list">
                                {displayLeagues.map((league) => {
                                    const locationText = Array.isArray(league.locations) && league.locations.length > 0
                                        ? league.locations.join(", ")
                                        : league.location || null;
                                    const startDate = league.startDate
                                        ? new Date(league.startDate).toLocaleDateString("en-US", { timeZone: "UTC" })
                                        : null;
                                    const endDate = league.endDate
                                        ? new Date(league.endDate).toLocaleDateString("en-US", { timeZone: "UTC" })
                                        : null;
                                    return (
                                        <div key={league._id} className="leagues-card-item">
                                            <div className="leagues-card-item-header">
                                                <div className="leagues-card-item-title">{league.name}</div>
                                                <span className={`admin-badge ${league.type === "active" ? "player" : ""}`} style={{ flexShrink: 0 }}>
                                                    {league.type === "active" ? "Active" : "Past"}
                                                </span>
                                            </div>
                                            <div className="leagues-card-item-meta">
                                                {isAdmin && league.organization?.name && (
                                                    <span><strong>Org:</strong> {league.organization.name}</span>
                                                )}
                                                {league.season?.name && (
                                                    <span><strong>Season:</strong> {league.season.name}</span>
                                                )}
                                                {league.category && (
                                                    <span><strong>Category:</strong> {league.category}</span>
                                                )}
                                                {locationText && (
                                                    <span><strong>Location:</strong> {locationText}</span>
                                                )}
                                                {(startDate || endDate) && (
                                                    <span>{startDate || "—"} → {endDate || "—"}</span>
                                                )}
                                            </div>
                                            <div className="leagues-card-item-actions">
                                                {canUpdate && (
                                                    <button
                                                        className="admin-btn admin-btn-ghost admin-btn-sm"
                                                        onClick={() => setTeamsTarget(league)}
                                                    >
                                                        <i className="fa-solid fa-people-group"></i> Teams
                                                    </button>
                                                )}
                                                {canUpdate && (
                                                    <button
                                                        className="admin-btn admin-btn-ghost admin-btn-sm"
                                                        onClick={() => { setEditTarget(league); setShowModal(true); }}
                                                    >
                                                        <i className="fa-solid fa-pen"></i> Edit
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        className="admin-btn admin-btn-danger admin-btn-sm"
                                                        onClick={() => deleteLeague(league)}
                                                    >
                                                        <i className="fa-solid fa-trash"></i> Delete
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            )}

            {showModal && (
                <LeagueModal
                    initial={editTarget}
                    isAdmin={isAdmin}
                    organizations={organizations}
                    userOrgId={userOrgId}
                    userOrgName={userOrgName}
                    userOrgSlug={userOrgSlug}
                    onClose={() => { setShowModal(false); setEditTarget(null); }}
                    onSave={handleSave}
                />
            )}

            {teamsTarget && (
                <LeagueTeamsModal
                    league={teamsTarget}
                    onClose={() => setTeamsTarget(null)}
                />
            )}

            {showPlaceholdersModal && (
                <PlaceholderTeamsModal
                    isAdmin={isAdmin}
                    organizations={organizations}
                    userOrgId={userOrgId}
                    onClose={() => setShowPlaceholdersModal(false)}
                />
            )}
        </AdminLayout>
    );
}
