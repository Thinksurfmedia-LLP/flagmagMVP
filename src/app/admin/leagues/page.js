"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout, { hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";
import WeekdayDatePicker from "@/components/WeekdayDatePicker";

function LeagueModal({ onClose, onSave, initial, isAdmin, organizations, userOrgId, userOrgName, userOrgSlug }) {
    const { showSuccess, showError } = useToast();
    const [form, setForm] = useState({
        name: initial?.name || "",
        type: initial?.type || "active",
        category: initial?.category || "",
        locations: Array.isArray(initial?.locations)
            ? initial.locations
            : initial?.location
                ? [initial.location]
                : [],
        startDate: initial?.startDate ? new Date(initial.startDate).toISOString().split("T")[0] : "",
        endDate: initial?.endDate ? new Date(initial.endDate).toISOString().split("T")[0] : "",
        image: initial?.image || "",
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
        // Notify admin about the override
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
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (data.success) setForm(prev => ({ ...prev, image: data.url }));
        } catch {}
        setUploading(false);
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
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
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
                    <div className="admin-card-header">
                        <h3>Leagues ({leagues.length})</h3>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                                className="admin-form-input"
                                placeholder="Search..."
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                style={{ width: 200, height: 36, fontSize: 13 }}
                            />
                            {canCreate && (
                                <button
                                    className="admin-btn admin-btn-primary"
                                    onClick={() => { setEditTarget(null); setShowModal(true); }}
                                >
                                    <i className="fa-solid fa-plus"></i> Add League
                                </button>
                            )}
                        </div>
                    </div>

                    {loading ? (
                        <div className="admin-loading"><div className="admin-spinner"></div>Loading leagues...</div>
                    ) : leagues.length === 0 ? (
                        <div className="admin-empty">
                            <i className="fa-solid fa-trophy"></i>
                            <p>No leagues found.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        {isAdmin && <th>Organization</th>}
                                        <th>Season</th>
                                        <th>Status</th>
                                        <th>Category</th>
                                        <th>Location</th>
                                        <th>Start Date</th>
                                        <th>End Date</th>
                                        <th style={{ width: 120 }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {leagues.map((league) => (
                                        <tr key={league._id}>
                                            <td style={{ fontWeight: 600 }}>{league.name}</td>
                                            {isAdmin && (
                                                <td style={{ color: "#5a5f72" }}>
                                                    {league.organization?.name || "-"}
                                                </td>
                                            )}
                                            <td style={{ color: "#5a5f72" }}>
                                                {league.season?.name || "-"}
                                                {league.seasonOverridden && (
                                                    <span title="Season was overridden" style={{ color: "#FF1E00", marginLeft: 4, fontSize: 11 }}>
                                                        <i className="fa-solid fa-triangle-exclamation"></i>
                                                    </span>
                                                )}
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
                                                    ? new Date(league.startDate).toLocaleDateString()
                                                    : "-"}
                                            </td>
                                            <td style={{ color: "#8b90a0", fontSize: 13 }}>
                                                {league.endDate
                                                    ? new Date(league.endDate).toLocaleDateString()
                                                    : "-"}
                                            </td>
                                            <td>
                                                <div style={{ display: "flex", gap: 6 }}>
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
        </AdminLayout>
    );
}
