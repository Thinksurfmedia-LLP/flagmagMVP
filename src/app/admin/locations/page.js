"use client";

import { useState, useMemo } from "react";
import Select from "react-select";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";
import { US_STATES, US_COUNTIES } from "@/lib/usGeoData";

/* ── react-select theme to match admin UI ── */
const selectStyles = {
    control: (base, state) => ({
        ...base,
        minHeight: 36,
        fontSize: 14,
        borderColor: state.isFocused ? "#FF1E00" : "#d5d8e0",
        boxShadow: state.isFocused ? "0 0 0 3px rgba(255,30,0,0.08)" : "none",
        "&:hover": { borderColor: state.isFocused ? "#FF1E00" : "#b0b4c0" },
    }),
    option: (base, state) => ({
        ...base,
        fontSize: 14,
        backgroundColor: state.isSelected ? "#FF1E00" : state.isFocused ? "#fff0ed" : "#fff",
        color: state.isSelected ? "#fff" : "#1a1d26",
        "&:active": { backgroundColor: "#FF1E00", color: "#fff" },
    }),
    placeholder: (base) => ({ ...base, color: "#a0a4b2" }),
    singleValue: (base) => ({ ...base, color: "#1a1d26" }),
    menu: (base) => ({ ...base, zIndex: 20 }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

export default function AdminLocationsPage() {
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();

    // Filter dropdowns
    const [selectedState, setSelectedState] = useState(null);
    const [selectedCounty, setSelectedCounty] = useState(null);

    // Location data
    const [locations, setLocations] = useState([]);
    const [countyId, setCountyId] = useState(null);
    const [loadingLocs, setLoadingLocs] = useState(false);

    // Add/Edit location form
    const [locName, setLocName] = useState("");
    const [locAddress, setLocAddress] = useState("");
    const [editingLocation, setEditingLocation] = useState(null);

    /* ── Dropdown options (built from static US data) ── */
    const stateOptions = useMemo(
        () => US_STATES.map((s) => ({ value: s.abbr, label: `${s.name} (${s.abbr})`, name: s.name })),
        []
    );

    const countyOptions = useMemo(() => {
        if (!selectedState) return [];
        const list = US_COUNTIES[selectedState.value] || [];
        return list.map((c) => ({ value: c, label: c }));
    }, [selectedState]);

    /* ── Fetch locations for a state + county combo ── */
    const fetchLocations = async (stateAbbr, countyName) => {
        setLoadingLocs(true);
        try {
            const params = new URLSearchParams({ stateAbbr, countyName });
            const res = await fetch(`/api/locations/by-geo?${params}`);
            const data = await res.json();
            if (data.success) {
                setLocations(data.data);
                setCountyId(data.countyId);
            }
        } catch {
            showError("Failed to load locations");
        } finally {
            setLoadingLocs(false);
        }
    };

    /* ── Handlers ── */
    const handleStateChange = (opt) => {
        setSelectedState(opt);
        setSelectedCounty(null);
        setLocations([]);
        setCountyId(null);
        resetLocationForm();
    };

    const handleCountyChange = (opt) => {
        setSelectedCounty(opt);
        setLocations([]);
        setCountyId(null);
        resetLocationForm();
        if (opt && selectedState) {
            fetchLocations(selectedState.value, opt.value);
        }
    };

    const resetLocationForm = () => {
        setLocName("");
        setLocAddress("");
        setEditingLocation(null);
    };

    /* ── CRUD ── */
    const saveLocation = async (e) => {
        e.preventDefault();
        if (!selectedState || !selectedCounty) {
            showError("Please select a state and county first");
            return;
        }

        const isEdit = !!editingLocation;

        if (isEdit) {
            const res = await fetch(`/api/locations/${editingLocation._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: locName, address: locAddress }),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            showSuccess("Location updated!");
        } else {
            const res = await fetch("/api/locations/by-geo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    stateAbbr: selectedState.value,
                    stateName: selectedState.name,
                    countyName: selectedCounty.value,
                    locationName: locName,
                    locationAddress: locAddress,
                }),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            if (data.countyId) setCountyId(data.countyId);
            showSuccess("Location added!");
        }

        resetLocationForm();
        fetchLocations(selectedState.value, selectedCounty.value);
    };

    const startEditLocation = (loc) => {
        setLocName(loc.name);
        setLocAddress(loc.address || "");
        setEditingLocation(loc);
    };

    const deleteLocation = async (loc) => {
        if (!confirm(`Delete "${loc.name}"?`)) return;
        const res = await fetch(`/api/locations/${loc._id}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) { showError(data.error); return; }
        showSuccess("Location deleted!");
        if (selectedState && selectedCounty) {
            fetchLocations(selectedState.value, selectedCounty.value);
        }
    };

    const canManage = user && hasAccess(user, "manage_organizations");

    return (
        <AdminLayout title="Locations">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage locations.</p>
                </div>
            ) : (
                <>
                    {/* ── Filter bar ── */}
                    <div className="admin-card" style={{ marginBottom: 16 }}>
                        <div className="admin-card-body" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                            <div style={{ flex: 1, minWidth: 220 }}>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5a5f72", marginBottom: 4 }}>State</label>
                                <Select
                                    options={stateOptions}
                                    value={selectedState}
                                    onChange={handleStateChange}
                                    placeholder="Search for a state..."
                                    isClearable
                                    styles={selectStyles}
                                    menuPortalTarget={document.body}
                                />
                            </div>
                            <div style={{ flex: 1, minWidth: 220 }}>
                                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#5a5f72", marginBottom: 4 }}>County</label>
                                <Select
                                    options={countyOptions}
                                    value={selectedCounty}
                                    onChange={handleCountyChange}
                                    placeholder={selectedState ? "Search for a county..." : "Select a state first..."}
                                    isClearable
                                    isDisabled={!selectedState}
                                    styles={selectStyles}
                                    menuPortalTarget={document.body}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Locations card ── */}
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3>
                                <i className="fa-solid fa-location-dot" style={{ marginRight: 8, color: "#FF1E00" }}></i>
                                Locations
                                {selectedCounty && ` — ${selectedCounty.label}, ${selectedState?.value}`}
                            </h3>
                        </div>
                        <div className="admin-card-body">
                            {!selectedCounty ? (
                                <div className="admin-empty">
                                    <i className="fa-solid fa-filter"></i>
                                    <p>{!selectedState ? "Select a state and county above to manage locations." : "Now select a county to view its locations."}</p>
                                </div>
                            ) : loadingLocs ? (
                                <div className="admin-loading">
                                    <div className="admin-spinner"></div>
                                    Loading locations...
                                </div>
                            ) : (
                                <>
                                    {/* Add / Edit form */}
                                    <form onSubmit={saveLocation} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                                        <input className="admin-form-input" placeholder="Location name *" value={locName} onChange={(e) => setLocName(e.target.value)} required style={{ flex: 1, minWidth: 140 }} />
                                        <input className="admin-form-input" placeholder="Address" value={locAddress} onChange={(e) => setLocAddress(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
                                        <button type="submit" className="admin-btn admin-btn-primary" style={{ whiteSpace: "nowrap" }}>
                                            {editingLocation ? <><i className="fa-solid fa-check"></i> Update</> : <><i className="fa-solid fa-plus"></i> Add Location</>}
                                        </button>
                                        {editingLocation && (
                                            <button type="button" className="admin-btn admin-btn-ghost" onClick={resetLocationForm}>Cancel</button>
                                        )}
                                    </form>

                                    {/* Locations table */}
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
                                                    {locations.map((loc) => (
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
                </>
            )}
        </AdminLayout>
    );
}
