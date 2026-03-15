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

export default function AdminVenuesPage() {
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();

    // Filter dropdowns
    const [selectedState, setSelectedState] = useState(null);
    const [selectedCounty, setSelectedCounty] = useState(null);

    // Venue data
    const [venues, setVenues] = useState([]);
    const [countyId, setCountyId] = useState(null);
    const [loadingVenues, setLoadingVenues] = useState(false);

    // Add/Edit form
    const [venueName, setVenueName] = useState("");
    const [venueAddress, setVenueAddress] = useState("");
    const [fieldCount, setFieldCount] = useState("");
    const [managerName, setManagerName] = useState("");
    const [managerPhone, setManagerPhone] = useState("");
    const [editingVenue, setEditingVenue] = useState(null);

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

    /* ── Fetch venues for a state + county combo ── */
    const fetchVenues = async (stateAbbr, countyName) => {
        setLoadingVenues(true);
        try {
            const params = new URLSearchParams({ stateAbbr, countyName });
            const res = await fetch(`/api/locations/by-geo?${params}`);
            const data = await res.json();
            if (data.success) {
                setVenues(data.data);
                setCountyId(data.countyId);
            }
        } catch {
            showError("Failed to load venues");
        } finally {
            setLoadingVenues(false);
        }
    };

    /* ── Handlers ── */
    const handleStateChange = (opt) => {
        setSelectedState(opt);
        setSelectedCounty(null);
        setVenues([]);
        setCountyId(null);
        resetForm();
    };

    const handleCountyChange = (opt) => {
        setSelectedCounty(opt);
        setVenues([]);
        setCountyId(null);
        resetForm();
        if (opt && selectedState) {
            fetchVenues(selectedState.value, opt.value);
        }
    };

    const resetForm = () => {
        setVenueName("");
        setVenueAddress("");
        setFieldCount("");
        setManagerName("");
        setManagerPhone("");
        setEditingVenue(null);
    };

    /* ── CRUD ── */
    const saveVenue = async (e) => {
        e.preventDefault();
        if (!selectedState || !selectedCounty) {
            showError("Please select a state and county first");
            return;
        }

        const isEdit = !!editingVenue;

        if (isEdit) {
            const res = await fetch(`/api/locations/${editingVenue._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: venueName,
                    address: venueAddress,
                    fieldCount: fieldCount === "" ? null : Number(fieldCount),
                    managerName,
                    managerPhone,
                }),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            showSuccess("Venue updated!");
        } else {
            const res = await fetch("/api/locations/by-geo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    stateAbbr: selectedState.value,
                    stateName: selectedState.name,
                    countyName: selectedCounty.value,
                    venueName,
                    venueAddress,
                    fieldCount: fieldCount === "" ? null : Number(fieldCount),
                    managerName,
                    managerPhone,
                }),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            if (data.countyId) setCountyId(data.countyId);
            showSuccess("Venue added!");
        }

        resetForm();
        fetchVenues(selectedState.value, selectedCounty.value);
    };

    const startEditVenue = (v) => {
        setVenueName(v.name);
        setVenueAddress(v.address || "");
        setFieldCount(v.fieldCount ?? "");
        setManagerName(v.managerName || "");
        setManagerPhone(v.managerPhone || "");
        setEditingVenue(v);
    };

    const deleteVenue = async (v) => {
        if (!confirm(`Delete "${v.name}"?`)) return;
        const res = await fetch(`/api/locations/${v._id}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) { showError(data.error); return; }
        showSuccess("Venue deleted!");
        if (selectedState && selectedCounty) {
            fetchVenues(selectedState.value, selectedCounty.value);
        }
    };

    const canManage = user && hasAccess(user, "manage_organizations");

    return (
        <AdminLayout title="Venues">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage venues.</p>
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
                                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
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
                                    menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Venues card ── */}
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3>
                                <i className="fa-solid fa-location-dot" style={{ marginRight: 8, color: "#FF1E00" }}></i>
                                Venues
                                {selectedCounty && ` — ${selectedCounty.label}, ${selectedState?.value}`}
                            </h3>
                        </div>
                        <div className="admin-card-body">
                            {!selectedCounty ? (
                                <div className="admin-empty">
                                    <i className="fa-solid fa-filter"></i>
                                    <p>{!selectedState ? "Select a state and county above to manage venues." : "Now select a county to view its venues."}</p>
                                </div>
                            ) : loadingVenues ? (
                                <div className="admin-loading">
                                    <div className="admin-spinner"></div>
                                    Loading venues...
                                </div>
                            ) : (
                                <>
                                    {/* Add / Edit form */}
                                    <form onSubmit={saveVenue} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                                        <input className="admin-form-input" placeholder="Venue name *" value={venueName} onChange={(e) => setVenueName(e.target.value)} required style={{ flex: 2, minWidth: 140 }} />
                                        <input className="admin-form-input" placeholder="Address" value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} style={{ flex: 2, minWidth: 140 }} />
                                        <input type="number" min="0" className="admin-form-input" placeholder="Number of Fields" value={fieldCount} onChange={(e) => setFieldCount(e.target.value)} style={{ flex: 1, minWidth: 130 }} />
                                        <input className="admin-form-input" placeholder="Location Manager" value={managerName} onChange={(e) => setManagerName(e.target.value)} style={{ flex: 1, minWidth: 130 }} />
                                        <input className="admin-form-input" placeholder="Phone Number" value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
                                        <button type="submit" className="admin-btn admin-btn-primary" style={{ whiteSpace: "nowrap" }}>
                                            {editingVenue ? <><i className="fa-solid fa-check"></i> Update</> : <><i className="fa-solid fa-plus"></i> Add Venue</>}
                                        </button>
                                        {editingVenue && (
                                            <button type="button" className="admin-btn admin-btn-ghost" onClick={resetForm}>Cancel</button>
                                        )}
                                    </form>

                                    {/* Venues table */}
                                    {venues.length === 0 ? (
                                        <div className="admin-empty">
                                            <i className="fa-solid fa-location-dot"></i>
                                            <p>No venues yet. Add one above.</p>
                                        </div>
                                    ) : (
                                        <div style={{ overflowX: "auto" }}>
                                            <table className="admin-table">
                                                <thead>
                                                    <tr>
                                                        <th>Name</th>
                                                        <th>Address</th>
                                                        <th>Fields</th>
                                                        <th>Location Manager</th>
                                                        <th>Phone</th>
                                                        <th style={{ width: 120 }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {venues.map((v) => (
                                                        <tr key={v._id}>
                                                            <td style={{ fontWeight: 600 }}>{v.name}</td>
                                                            <td style={{ color: "#5a5f72" }}>{v.address || "—"}</td>
                                                            <td>{v.fieldCount ?? "—"}</td>
                                                            <td>{v.managerName || "—"}</td>
                                                            <td>{v.managerPhone || "—"}</td>
                                                            <td>
                                                                <div style={{ display: "flex", gap: 6 }}>
                                                                    <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => startEditVenue(v)} title="Edit">
                                                                        <i className="fa-solid fa-pen"></i>
                                                                    </button>
                                                                    <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteVenue(v)} title="Delete">
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
