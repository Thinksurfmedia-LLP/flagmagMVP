"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import Link from "next/link";
import Select, { components } from "react-select";
import { useRouter } from "next/navigation";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";
import { useImpersonation } from "@/components/ImpersonationProvider";
import { formatOrganizationLocations } from "@/lib/organizationLocations";

const CATEGORY_OPTIONS = ["Men", "Youth", "Women", "Co-ed"];
const SCHEDULE_DAY_OPTIONS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 42,
        fontSize: 14,
        borderColor: state.isFocused ? "#FF1E00" : "#d5d8e0",
        boxShadow: state.isFocused ? "0 0 0 3px rgba(255,30,0,0.08)" : "none",
        "&:hover": { borderColor: state.isFocused ? "#FF1E00" : "#b0b4c0" },
    }),
    option: (base, state) => ({
        ...base,
        fontSize: 14,
        backgroundColor: state.isSelected ? "rgba(255,30,0,0.08)" : state.isFocused ? "#fff0ed" : "#fff",
        color: "#1a1d26",
    }),
    multiValue: (base) => ({
        ...base,
        backgroundColor: "rgba(255,30,0,0.08)",
        borderRadius: 999,
    }),
    multiValueLabel: (base) => ({
        ...base,
        color: "#FF1E00",
        fontWeight: 600,
        paddingLeft: 10,
    }),
    multiValueRemove: (base) => ({
        ...base,
        color: "#FF1E00",
        ":hover": {
            backgroundColor: "rgba(255,30,0,0.12)",
            color: "#d41800",
        },
    }),
    menu: (base) => ({ ...base, zIndex: 20 }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

function CheckboxOption(props) {
    return (
        <components.Option {...props}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" checked={props.isSelected} readOnly style={{ accentColor: "#FF1E00" }} />
                <span>{props.label}</span>
            </div>
        </components.Option>
    );
}

function OrgForm({ org, onSave, onCancel }) {
    const [form, setForm] = useState(
        org || {
            name: "", slug: "", description: "", location: "",
            sport: "Flag Football", rating: 0, memberCount: 0,
            foundedYear: new Date().getFullYear(), categories: [], scheduleDays: [], locations: [],
        }
    );
    const [selectedCategories, setSelectedCategories] = useState(org?.categories?.length ? org.categories : (org?.tags || []));
    const [selectedDays, setSelectedDays] = useState(org?.scheduleDays || []);
    const [selectedLocations, setSelectedLocations] = useState(org?.locations || []);
    const [selectedLocationIds, setSelectedLocationIds] = useState(
        (org?.locations || []).map((entry) => String(entry.county || entry.countyId)).filter(Boolean)
    );
    const [availableLocations, setAvailableLocations] = useState([]);
    const [formError, setFormError] = useState("");

    useEffect(() => {
        const loadAvailableLocations = async () => {
            try {
                const res = await fetch("/api/locations");
                const data = await res.json();
                if (data.success) setAvailableLocations(data.data || []);
            } catch {
                setAvailableLocations([]);
            }
        };
        loadAvailableLocations();
    }, []);

    const toggleCategory = (category) => {
        setSelectedCategories((prev) => (
            prev.includes(category)
                ? prev.filter((entry) => entry !== category)
                : [...prev, category]
        ));
    };

    const toggleDay = (day) => {
        setSelectedDays((prev) => (
            prev.includes(day)
                ? prev.filter((entry) => entry !== day)
                : [...prev, day]
        ));
    };

    useEffect(() => {
        if (!availableLocations.length) return;

        const selectedFromList = selectedLocationIds
            .map((id) => availableLocations.find((entry) => String(entry._id) === String(id)))
            .filter(Boolean)
            .map((entry) => ({
                state: entry.stateId,
                county: entry.countyId,
                location: null,
                stateName: entry.stateName,
                stateAbbr: entry.stateAbbr,
                countyName: entry.countyName,
                locationName: `${entry.countyName} (${entry.stateAbbr || entry.stateName})`,
            }));

        const unmatchedExisting = (org?.locations || []).filter(
            (entry) => !selectedFromList.some((selectedEntry) => String(selectedEntry.county) === String(entry.county || entry.countyId))
        );

        setSelectedLocations([...selectedFromList, ...unmatchedExisting]);
    }, [availableLocations, selectedLocationIds, org?.locations]);

    const countyOptions = availableLocations.reduce((accumulator, entry) => {
        const key = String(entry.countyId);
        if (accumulator.some((option) => option.value === key)) return accumulator;

        accumulator.push({
            value: key,
            label: `${entry.countyName} (${entry.stateAbbr || entry.stateName})`,
            countyId: entry.countyId,
            countyName: entry.countyName,
            stateId: entry.stateId,
            stateName: entry.stateName,
            stateAbbr: entry.stateAbbr,
        });

        return accumulator;
    }, []).sort((left, right) => left.label.localeCompare(right.label));

    const selectedCountyOptions = countyOptions.filter((option) => selectedLocationIds.includes(String(option.value)));

    const handleSubmit = (e) => {
        e.preventDefault();
        setFormError("");

        if (selectedLocations.length === 0) {
            setFormError("Please select at least one operating location from the Venues list.");
            return;
        }

        const locationNames = selectedLocations.map((entry) => entry.locationName || entry.countyName).filter(Boolean);
        onSave({
            ...form,
            categories: selectedCategories,
            tags: selectedCategories,
            scheduleDays: selectedDays,
            locations: selectedLocations,
            location: locationNames.join(", "),
        });
    };

    return (
        <div className="admin-inline-form">
            <form onSubmit={handleSubmit}>
                {formError && (
                    <div className="admin-alert admin-alert-error" style={{ marginBottom: 12 }}>
                        <i className="fa-solid fa-exclamation-circle"></i>
                        {formError}
                    </div>
                )}
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
                        <label className="admin-form-label">Founded Year</label>
                        <input type="number" className="admin-form-input" value={form.foundedYear || ""} onChange={e => setForm({ ...form, foundedYear: +e.target.value })} />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Rating (0-5)</label>
                        <input type="number" step="0.1" min="0" max="5" className="admin-form-input" value={form.rating} onChange={e => setForm({ ...form, rating: +e.target.value })} />
                    </div>

                    <div className="admin-form-group">
                        <label className="admin-form-label">Categories</label>
                        <div className="admin-option-bubbles">
                            {CATEGORY_OPTIONS.map((category) => (
                                <button
                                    key={category}
                                    type="button"
                                    className={`admin-option-bubble ${selectedCategories.includes(category) ? "selected" : ""}`}
                                    onClick={() => toggleCategory(category)}
                                >
                                    {category}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Schedule Days</label>
                        <div className="admin-option-bubbles">
                            {SCHEDULE_DAY_OPTIONS.map((day) => (
                                <button
                                    key={day}
                                    type="button"
                                    className={`admin-option-bubble ${selectedDays.includes(day) ? "selected" : ""}`}
                                    onClick={() => toggleDay(day)}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="admin-form-group" style={{ gridColumn: "span 2" }}>
                        <label className="admin-form-label">Operating Locations *</label>
                        <Select
                            isMulti
                            closeMenuOnSelect={false}
                            hideSelectedOptions={false}
                            options={countyOptions}
                            value={selectedCountyOptions}
                            onChange={(options) => setSelectedLocationIds((options || []).map((option) => String(option.value)))}
                            placeholder="Search counties from Venues list..."
                            noOptionsMessage={() => "No pre-created locations found. Create them first in Venues."}
                            components={{ Option: CheckboxOption }}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                        />
                    </div>

                    <div className="admin-form-group" style={{ gridColumn: "span 2" }}>
                        <label className="admin-form-label">Description</label>
                        <textarea className="admin-form-input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
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
    const router = useRouter();
    const { enterImpersonation } = useImpersonation();
    const [orgs, setOrgs] = useState([]);
    const [loading, setLoading] = useState(true);
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
    const { showSuccess, showError } = useToast();

    const flash = (msg) => { showSuccess(msg); };

    const fetchOrgs = useCallback(async () => {
        try {
            const res = await fetch("/api/organizations");
            const data = await res.json();
            if (data.success) setOrgs(data.data);
        } catch { showError("Failed to load organizations"); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

    const saveOrg = async (formData) => {
        const isEdit = !!editOrg;
        const url = isEdit ? `/api/organizations/${editOrg.slug}` : "/api/organizations";
        const method = isEdit ? "PUT" : "POST";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
        const data = await res.json();
        if (!data.success) { showError(data.error); return; }
        setShowOrgForm(false); setEditOrg(null); fetchOrgs();
        flash(isEdit ? "Organization updated!" : "Organization created!");
    };

    const deleteOrg = async (slug) => {
        if (!confirm("Delete this organization? This cannot be undone.")) return;
        const res = await fetch(`/api/organizations/${slug}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) { showError(data.error); return; }
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
        const isEdit = !!editSeason;
        const url = isEdit ? `/api/seasons/${editSeason._id}` : `/api/organizations/${orgSlug}/seasons`;
        const method = isEdit ? "PUT" : "POST";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
        const data = await res.json();
        if (!data.success) { showError(data.error); return; }
        setShowSeasonForm(null); setEditSeason(null); fetchSeasons(orgSlug);
        flash(isEdit ? "Season updated!" : "Season created!");
    };

    const deleteSeason = async (seasonId, orgSlug) => {
        if (!confirm("Delete this season?")) return;
        const res = await fetch(`/api/seasons/${seasonId}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) { showError(data.error); return; }
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
        const isEdit = !!editGame;
        const url = isEdit ? `/api/games/${editGame._id}` : `/api/seasons/${seasonId}/games`;
        const method = isEdit ? "PUT" : "POST";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(formData) });
        const data = await res.json();
        if (!data.success) { showError(data.error); return; }
        setShowGameForm(null); setEditGame(null); fetchGames(seasonId);
        flash(isEdit ? "Game updated!" : "Game created!");
    };

    const deleteGame = async (gameId, seasonId) => {
        if (!confirm("Delete this game?")) return;
        const res = await fetch(`/api/games/${gameId}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) { showError(data.error); return; }
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
                                <div className="admin-loading">
                                    <div className="admin-spinner"></div>
                                    Loading organizations...
                                </div>
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
                                                        <td>{formatOrganizationLocations(org)}</td>
                                                        <td>⭐ {org.rating}</td>
                                                        <td>{org.memberCount}</td>
                                                        <td style={{ width: 180 }}>
                                                            <div style={{ display: "flex", gap: 6 }}>
                                                                <button className="admin-btn admin-btn-primary admin-btn-sm" title="Manage as organizer" onClick={() => { enterImpersonation(org); router.push(`/admin/organizations/${org.slug}`); }}>
                                                                    <i className="fa-solid fa-user-secret"></i>
                                                                </button>
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
