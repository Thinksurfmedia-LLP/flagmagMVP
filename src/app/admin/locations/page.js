"use client";

import { useState, useEffect, useCallback } from "react";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

export default function AdminLocationsPage() {
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();
    const [activeTab, setActiveTab] = useState("states");

    // Data
    const [states, setStates] = useState([]);
    const [counties, setCounties] = useState([]);
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters for counties & locations tabs
    const [filterState, setFilterState] = useState("");
    const [filterCounty, setFilterCounty] = useState("");
    const [countyFilterStates, setCountyFilterStates] = useState([]); // counties belonging to selected state on locations tab

    // Add/Edit: States
    const [stateName, setStateName] = useState("");
    const [stateAbbr, setStateAbbr] = useState("");
    const [editingState, setEditingState] = useState(null);

    // Add/Edit: Counties
    const [countyName, setCountyName] = useState("");
    const [countyStateId, setCountyStateId] = useState("");
    const [editingCounty, setEditingCounty] = useState(null);

    // Add/Edit: Locations
    const [locName, setLocName] = useState("");
    const [locAddress, setLocAddress] = useState("");
    const [locCountyId, setLocCountyId] = useState("");
    const [editingLocation, setEditingLocation] = useState(null);

    /* ── Fetch ── */

    const fetchStates = useCallback(async () => {
        try {
            const res = await fetch("/api/states");
            const data = await res.json();
            if (data.success) setStates(data.data);
        } catch { showError("Failed to load states"); }
        finally { setLoading(false); }
    }, [showError]);

    useEffect(() => { fetchStates(); }, [fetchStates]);

    const fetchCounties = async (stateId) => {
        if (!stateId) { setCounties([]); return; }
        const res = await fetch(`/api/states/${stateId}/counties`);
        const data = await res.json();
        if (data.success) setCounties(data.data);
    };

    const fetchLocations = async (countyId) => {
        if (!countyId) { setLocations([]); return; }
        const res = await fetch(`/api/counties/${countyId}/locations`);
        const data = await res.json();
        if (data.success) setLocations(data.data);
    };

    // When filter state changes on Counties tab
    const handleCountyFilterState = (stateId) => {
        setFilterState(stateId);
        setCounties([]);
        resetCountyForm();
        if (stateId) fetchCounties(stateId);
    };

    // When filter state changes on Locations tab
    const handleLocFilterState = async (stateId) => {
        setFilterState(stateId);
        setFilterCounty("");
        setCountyFilterStates([]);
        setLocations([]);
        resetLocationForm();
        if (stateId) {
            const res = await fetch(`/api/states/${stateId}/counties`);
            const data = await res.json();
            if (data.success) setCountyFilterStates(data.data);
        }
    };

    const handleLocFilterCounty = (countyId) => {
        setFilterCounty(countyId);
        setLocations([]);
        resetLocationForm();
        if (countyId) fetchLocations(countyId);
    };

    // Tab switch resets
    const switchTab = (tab) => {
        setActiveTab(tab);
        setFilterState("");
        setFilterCounty("");
        setCounties([]);
        setLocations([]);
        setCountyFilterStates([]);
        resetStateForm();
        resetCountyForm();
        resetLocationForm();
    };

    /* ── Reset helpers ── */
    const resetStateForm = () => { setStateName(""); setStateAbbr(""); setEditingState(null); };
    const resetCountyForm = () => { setCountyName(""); setCountyStateId(""); setEditingCounty(null); };
    const resetLocationForm = () => { setLocName(""); setLocAddress(""); setLocCountyId(""); setEditingLocation(null); };

    /* ── CRUD: States ── */

    const saveState = async (e) => {
        e.preventDefault();
        const isEdit = !!editingState;
        const url = isEdit ? `/api/states/${editingState._id}` : "/api/states";
        const method = isEdit ? "PUT" : "POST";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: stateName, abbreviation: stateAbbr }) });
        const data = await res.json();
        if (!data.success) { showError(data.error); return; }
        resetStateForm();
        fetchStates();
        showSuccess(isEdit ? "State updated!" : "State added!");
    };

    const startEditState = (st) => { setStateName(st.name); setStateAbbr(st.abbreviation || ""); setEditingState(st); };

    const deleteState = async (st) => {
        if (!confirm(`Delete "${st.name}" and all its counties & locations?`)) return;
        const res = await fetch(`/api/states/${st._id}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) { showError(data.error); return; }
        fetchStates();
        showSuccess("State deleted!");
    };

    /* ── CRUD: Counties ── */

    const saveCounty = async (e) => {
        e.preventDefault();
        const stateId = editingCounty ? (countyStateId || editingCounty.state) : (countyStateId || filterState);
        if (!stateId) { showError("Please select a state"); return; }
        const isEdit = !!editingCounty;
        const url = isEdit ? `/api/counties/${editingCounty._id}` : `/api/states/${stateId}/counties`;
        const method = isEdit ? "PUT" : "POST";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: countyName }) });
        const data = await res.json();
        if (!data.success) { showError(data.error); return; }
        resetCountyForm();
        if (filterState) fetchCounties(filterState);
        showSuccess(isEdit ? "County updated!" : "County added!");
    };

    const startEditCounty = (cn) => { setCountyName(cn.name); setCountyStateId(cn.state); setEditingCounty(cn); };

    const deleteCounty = async (cn) => {
        if (!confirm(`Delete "${cn.name}" and all its locations?`)) return;
        const res = await fetch(`/api/counties/${cn._id}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) { showError(data.error); return; }
        if (filterState) fetchCounties(filterState);
        showSuccess("County deleted!");
    };

    /* ── CRUD: Locations ── */

    const saveLocation = async (e) => {
        e.preventDefault();
        const countyId = editingLocation ? (locCountyId || editingLocation.county) : (locCountyId || filterCounty);
        if (!countyId) { showError("Please select a county"); return; }
        const isEdit = !!editingLocation;
        const url = isEdit ? `/api/locations/${editingLocation._id}` : `/api/counties/${countyId}/locations`;
        const method = isEdit ? "PUT" : "POST";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: locName, address: locAddress }) });
        const data = await res.json();
        if (!data.success) { showError(data.error); return; }
        resetLocationForm();
        if (filterCounty) fetchLocations(filterCounty);
        showSuccess(isEdit ? "Location updated!" : "Location added!");
    };

    const startEditLocation = (loc) => { setLocName(loc.name); setLocAddress(loc.address || ""); setLocCountyId(loc.county); setEditingLocation(loc); };

    const deleteLocation = async (loc) => {
        if (!confirm(`Delete "${loc.name}"?`)) return;
        const res = await fetch(`/api/locations/${loc._id}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) { showError(data.error); return; }
        if (filterCounty) fetchLocations(filterCounty);
        showSuccess("Location deleted!");
    };

    const canManage = user && hasAccess(user, "manage_organizations");

    return (
        <AdminLayout title="Locations">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage locations.</p>
                </div>
            ) : loading ? (
                <div style={{ textAlign: "center", color: "#8b90a0", padding: 40 }}>Loading...</div>
            ) : (
                <>
                    {/* ── Tabs ── */}
                    <div className="admin-tabs">
                        <button className={`admin-tab ${activeTab === "states" ? "active" : ""}`} onClick={() => switchTab("states")}>
                            <i className="fa-solid fa-map" style={{ marginRight: 6 }}></i> States
                        </button>
                        <button className={`admin-tab ${activeTab === "counties" ? "active" : ""}`} onClick={() => switchTab("counties")}>
                            <i className="fa-solid fa-map-pin" style={{ marginRight: 6 }}></i> Counties
                        </button>
                        <button className={`admin-tab ${activeTab === "locations" ? "active" : ""}`} onClick={() => switchTab("locations")}>
                            <i className="fa-solid fa-location-dot" style={{ marginRight: 6 }}></i> Locations
                        </button>
                    </div>

                    {/* ── States Tab ── */}
                    {activeTab === "states" && (
                        <div className="admin-card">
                            <div className="admin-card-header">
                                <h3>All States ({states.length})</h3>
                            </div>
                            <div className="admin-card-body">
                                <form onSubmit={saveState} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                                    <input className="admin-form-input" placeholder="State name *" value={stateName} onChange={e => setStateName(e.target.value)} required style={{ flex: 2, minWidth: 120 }} />
                                    <input className="admin-form-input" placeholder="Abbreviation" value={stateAbbr} onChange={e => setStateAbbr(e.target.value)} style={{ flex: 1, minWidth: 100 }} maxLength={3} />
                                    <button type="submit" className="admin-btn admin-btn-primary" style={{ whiteSpace: "nowrap" }}>
                                        {editingState ? <><i className="fa-solid fa-check"></i> Update</> : <><i className="fa-solid fa-plus"></i> Add State</>}
                                    </button>
                                    {editingState && (
                                        <button type="button" className="admin-btn admin-btn-ghost" onClick={resetStateForm}>Cancel</button>
                                    )}
                                </form>

                                {states.length === 0 ? (
                                    <div className="admin-empty">
                                        <i className="fa-solid fa-map"></i>
                                        <p>No states yet. Add one above.</p>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: "auto" }}>
                                        <table className="admin-table">
                                            <thead>
                                                <tr>
                                                    <th>State</th>
                                                    <th>Abbreviation</th>
                                                    <th style={{ width: 120 }}>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {states.map(st => (
                                                    <tr key={st._id}>
                                                        <td style={{ fontWeight: 600 }}>{st.name}</td>
                                                        <td>{st.abbreviation || "—"}</td>
                                                        <td>
                                                            <div style={{ display: "flex", gap: 6 }}>
                                                                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => startEditState(st)} title="Edit">
                                                                    <i className="fa-solid fa-pen"></i>
                                                                </button>
                                                                <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteState(st)} title="Delete">
                                                                    <i className="fa-solid fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Counties Tab ── */}
                    {activeTab === "counties" && (
                        <div className="admin-card">
                            <div className="admin-card-header">
                                <h3>Counties</h3>
                                <select className="admin-form-select" value={filterState} onChange={e => handleCountyFilterState(e.target.value)} style={{ maxWidth: 240 }}>
                                    <option value="">Select a state...</option>
                                    {states.map(st => <option key={st._id} value={st._id}>{st.name}</option>)}
                                </select>
                            </div>
                            <div className="admin-card-body">
                                {!filterState ? (
                                    <div className="admin-empty">
                                        <i className="fa-solid fa-filter"></i>
                                        <p>Select a state above to view its counties.</p>
                                    </div>
                                ) : (
                                    <>
                                        <form onSubmit={saveCounty} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                                            <input className="admin-form-input" placeholder="County name *" value={countyName} onChange={e => setCountyName(e.target.value)} required style={{ flex: 1, minWidth: 160 }} />
                                            <button type="submit" className="admin-btn admin-btn-primary" style={{ whiteSpace: "nowrap" }}>
                                                {editingCounty ? <><i className="fa-solid fa-check"></i> Update</> : <><i className="fa-solid fa-plus"></i> Add County</>}
                                            </button>
                                            {editingCounty && (
                                                <button type="button" className="admin-btn admin-btn-ghost" onClick={resetCountyForm}>Cancel</button>
                                            )}
                                        </form>

                                        {counties.length === 0 ? (
                                            <div className="admin-empty">
                                                <i className="fa-solid fa-map-pin"></i>
                                                <p>No counties yet. Add one above.</p>
                                            </div>
                                        ) : (
                                            <div style={{ overflowX: "auto" }}>
                                                <table className="admin-table">
                                                    <thead>
                                                        <tr>
                                                            <th>County</th>
                                                            <th style={{ width: 120 }}>Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {counties.map(cn => (
                                                            <tr key={cn._id}>
                                                                <td style={{ fontWeight: 600 }}>{cn.name}</td>
                                                                <td>
                                                                    <div style={{ display: "flex", gap: 6 }}>
                                                                        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => startEditCounty(cn)} title="Edit">
                                                                            <i className="fa-solid fa-pen"></i>
                                                                        </button>
                                                                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteCounty(cn)} title="Delete">
                                                                            <i className="fa-solid fa-trash"></i>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Locations Tab ── */}
                    {activeTab === "locations" && (
                        <div className="admin-card">
                            <div className="admin-card-header">
                                <h3>Locations</h3>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <select className="admin-form-select" value={filterState} onChange={e => handleLocFilterState(e.target.value)} style={{ maxWidth: 200 }}>
                                        <option value="">Select state...</option>
                                        {states.map(st => <option key={st._id} value={st._id}>{st.name}</option>)}
                                    </select>
                                    <select className="admin-form-select" value={filterCounty} onChange={e => handleLocFilterCounty(e.target.value)} disabled={!filterState} style={{ maxWidth: 200 }}>
                                        <option value="">Select county...</option>
                                        {countyFilterStates.map(cn => <option key={cn._id} value={cn._id}>{cn.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="admin-card-body">
                                {!filterCounty ? (
                                    <div className="admin-empty">
                                        <i className="fa-solid fa-filter"></i>
                                        <p>{!filterState ? "Select a state and county above to view locations." : "Now select a county to view its locations."}</p>
                                    </div>
                                ) : (
                                    <>
                                        <form onSubmit={saveLocation} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                                            <input className="admin-form-input" placeholder="Location name *" value={locName} onChange={e => setLocName(e.target.value)} required style={{ flex: 1, minWidth: 140 }} />
                                            <input className="admin-form-input" placeholder="Address" value={locAddress} onChange={e => setLocAddress(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
                                            <button type="submit" className="admin-btn admin-btn-primary" style={{ whiteSpace: "nowrap" }}>
                                                {editingLocation ? <><i className="fa-solid fa-check"></i> Update</> : <><i className="fa-solid fa-plus"></i> Add Location</>}
                                            </button>
                                            {editingLocation && (
                                                <button type="button" className="admin-btn admin-btn-ghost" onClick={resetLocationForm}>Cancel</button>
                                            )}
                                        </form>

                                        {locations.length === 0 ? (
                                            <div className="admin-empty">
                                                <i className="fa-solid fa-location-dot"></i>
                                                <p>No locations yet. Add one above.</p>
                                            </div>
                                        ) : (
                                            <div style={{ overflowX: "auto" }}>
                                                <table className="admin-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Location</th>
                                                            <th>Address</th>
                                                            <th style={{ width: 120 }}>Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {locations.map(loc => (
                                                            <tr key={loc._id}>
                                                                <td style={{ fontWeight: 600 }}>{loc.name}</td>
                                                                <td style={{ color: "#5a5f72" }}>{loc.address || "—"}</td>
                                                                <td>
                                                                    <div style={{ display: "flex", gap: 6 }}>
                                                                        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => startEditLocation(loc)} title="Edit">
                                                                            <i className="fa-solid fa-pen"></i>
                                                                        </button>
                                                                        <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteLocation(loc)} title="Delete">
                                                                            <i className="fa-solid fa-trash"></i>
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </AdminLayout>
    );
}
