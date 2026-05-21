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
        leagueType: initial?.leagueType || "league",
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

    // Sort
    const [sortField, setSortField] = useState("name"); // "name" | "startDate" | "endDate"
    const [sortDir, setSortDir] = useState("asc"); // "asc" | "desc"

    // Filters
    const [allStates, setAllStates] = useState([]);
    const [allVenues, setAllVenues] = useState([]);
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
            .then((d) => { if (d.success) setAllStates(d.data || []); })
            .catch(() => {});
        fetch("/api/locations")
            .then((r) => r.json())
            .then((d) => { if (d.success) setAllVenues(d.data || []); })
            .catch(() => {});
    }, []);

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
                    <div className="admin-card-header">
                        <h3>Leagues ({displayLeagues.length})</h3>
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

                    {/* Filter + Sort bar */}
                    <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, padding: "10px 16px 10px", borderBottom: "1px solid #e8eaf0", marginBottom: 4, alignItems: "center" }}>
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
