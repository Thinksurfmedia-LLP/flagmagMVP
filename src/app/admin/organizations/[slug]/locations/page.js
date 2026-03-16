"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Select from "react-select";
import { useParams } from "next/navigation";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";
import { useToast } from "@/components/AdminToast";

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

function LocationModal({ open, editingVenue, orgLocations, onClose, onSave, loading }) {
    const [selectedState, setSelectedState] = useState(null);
    const [selectedCounty, setSelectedCounty] = useState(null);
    const [venueName, setVenueName] = useState("");
    const [venueAddress, setVenueAddress] = useState("");
    const [fieldCount, setFieldCount] = useState("");
    const [managerName, setManagerName] = useState("");
    const [managerPhone, setManagerPhone] = useState("");

    const stateOptions = useMemo(() => {
        const seen = new Set();
        return orgLocations
            .filter(l => { if (seen.has(l.stateAbbr)) return false; seen.add(l.stateAbbr); return true; })
            .map(l => ({ value: l.stateAbbr, label: `${l.stateName} (${l.stateAbbr})`, name: l.stateName }));
    }, [orgLocations]);

    const countyOptions = useMemo(() => {
        if (!selectedState) return [];
        return orgLocations
            .filter(l => l.stateAbbr === selectedState.value)
            .map(l => ({ value: l.countyName, label: l.countyName }));
    }, [orgLocations, selectedState]);

    useEffect(() => {
        if (!open) return;

        if (editingVenue) {
            const state = editingVenue.stateAbbr
                ? { value: editingVenue.stateAbbr, label: `${editingVenue.stateName} (${editingVenue.stateAbbr})`, name: editingVenue.stateName }
                : null;
            const county = editingVenue.countyName ? { value: editingVenue.countyName, label: editingVenue.countyName } : null;
            setSelectedState(state);
            setSelectedCounty(county);
            setVenueName(editingVenue.name || "");
            setVenueAddress(editingVenue.address || "");
            setFieldCount(editingVenue.fieldCount ?? "");
            setManagerName(editingVenue.managerName || "");
            setManagerPhone(editingVenue.managerPhone || "");
            return;
        }

        setSelectedState(null);
        setSelectedCounty(null);
        setVenueName("");
        setVenueAddress("");
        setFieldCount("");
        setManagerName("");
        setManagerPhone("");
    }, [open, editingVenue]);

    if (!open) return null;

    const submit = async (e) => {
        e.preventDefault();
        await onSave({ editingVenue, selectedState, selectedCounty, venueName, venueAddress, fieldCount, managerName, managerPhone });
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
                <h3 className="admin-modal-title">{editingVenue ? "Edit Location" : "Add Location"}</h3>
                <form onSubmit={submit}>
                    <div className="admin-form-group">
                        <label className="admin-form-label">State *</label>
                        <Select
                            options={stateOptions}
                            value={selectedState}
                            onChange={opt => { setSelectedState(opt); setSelectedCounty(null); }}
                            placeholder="Select state..."
                            isClearable
                            isDisabled={Boolean(editingVenue)}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                        />
                    </div>

                    <div className="admin-form-group">
                        <label className="admin-form-label">County *</label>
                        <Select
                            options={countyOptions}
                            value={selectedCounty}
                            onChange={setSelectedCounty}
                            placeholder={selectedState ? "Select county..." : "Select a state first..."}
                            isClearable
                            isDisabled={!selectedState || Boolean(editingVenue)}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                        />
                    </div>

                    <div className="admin-form-group">
                        <label className="admin-form-label">Location Name *</label>
                        <input
                            className="admin-form-input"
                            value={venueName}
                            onChange={e => setVenueName(e.target.value)}
                            placeholder="Location name"
                            required
                        />
                    </div>

                    <div className="admin-form-group">
                        <label className="admin-form-label">Address</label>
                        <input
                            className="admin-form-input"
                            value={venueAddress}
                            onChange={e => setVenueAddress(e.target.value)}
                            placeholder="Street address"
                        />
                    </div>

                    <div className="admin-form-group" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 180px" }}>
                            <label className="admin-form-label">Fields</label>
                            <input type="number" min="0" className="admin-form-input" value={fieldCount} onChange={e => setFieldCount(e.target.value)} placeholder="Number of fields" />
                        </div>
                        <div style={{ flex: "1 1 180px" }}>
                            <label className="admin-form-label">Manager</label>
                            <input className="admin-form-input" value={managerName} onChange={e => setManagerName(e.target.value)} placeholder="Manager" />
                        </div>
                        <div style={{ flex: "1 1 180px" }}>
                            <label className="admin-form-label">Phone Number</label>
                            <input className="admin-form-input" value={managerPhone} onChange={e => setManagerPhone(e.target.value)} placeholder="Phone number" />
                        </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
                        <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
                        <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>
                            {loading ? "Saving..." : editingVenue ? "Update Location" : "Add Location"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function OrgLocationsPage() {
    const { slug } = useParams();
    const { user, activeRole } = useAuth();
    const { org: impersonatedOrg, enterImpersonation } = useImpersonation();
    const { showSuccess, showError } = useToast();

    const [orgLocations, setOrgLocations] = useState([]);
    const [venues, setVenues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalSaving, setModalSaving] = useState(false);
    const [editingVenue, setEditingVenue] = useState(null);

    const effectiveRole = activeRole || user?.role;
    const isOwnOrg = effectiveRole === "organizer" && user?.organization?.slug === slug;
    const canManage = isOwnOrg || (user && hasAccess(user, "manage_organizations"));

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/organizations/${slug}`);
                const data = await res.json();
                if (data.success) {
                    if (!isOwnOrg && !impersonatedOrg) enterImpersonation(data.data);
                    setOrgLocations(data.data.locations || []);
                }
            } catch {}
        })();
    }, [slug]);

    const fetchVenues = useCallback(async (locs) => {
        setLoading(true);
        try {
            const res = await fetch("/api/locations");
            const data = await res.json();
            if (data.success) {
                setVenues((data.data || []).filter(v =>
                    locs.some(l => l.stateAbbr === v.stateAbbr && l.countyName === v.countyName)
                ));
            }
        } catch {
            showError("Failed to load locations");
        } finally {
            setLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        if (orgLocations.length > 0) fetchVenues(orgLocations);
        else setLoading(false);
    }, [orgLocations, fetchVenues]);

    const openAddModal = () => { setEditingVenue(null); setModalOpen(true); };
    const openEditModal = (venue) => { setEditingVenue(venue); setModalOpen(true); };
    const closeModal = () => { setModalOpen(false); setEditingVenue(null); };

    const saveVenue = async ({ editingVenue: venue, selectedState, selectedCounty, venueName, venueAddress, fieldCount, managerName, managerPhone }) => {
        if (!venue && (!selectedState || !selectedCounty)) {
            showError("Please select state and county");
            return;
        }
        if (!venueName?.trim()) {
            showError("Location name is required");
            return;
        }

        setModalSaving(true);
        try {
            if (venue) {
                const res = await fetch(`/api/locations/${venue._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: venueName.trim(),
                        address: venueAddress || "",
                        fieldCount: fieldCount === "" ? null : Number(fieldCount),
                        managerName: managerName || "",
                        managerPhone: managerPhone || "",
                    }),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error || "Failed to update location"); return; }
                showSuccess("Location updated!");
            } else {
                const stateObj = orgLocations.find(l => l.stateAbbr === selectedState.value);
                const res = await fetch("/api/locations/by-geo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        stateAbbr: selectedState.value,
                        stateName: stateObj?.stateName || selectedState.name,
                        countyName: selectedCounty.value,
                        venueName: venueName.trim(),
                        venueAddress: venueAddress || "",
                        fieldCount: fieldCount === "" ? null : Number(fieldCount),
                        managerName: managerName || "",
                        managerPhone: managerPhone || "",
                    }),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error || "Failed to add location"); return; }
                showSuccess("Location added!");
            }
            closeModal();
            fetchVenues(orgLocations);
        } catch {
            showError("Failed to save location");
        } finally {
            setModalSaving(false);
        }
    };

    const deleteVenue = async (venue) => {
        if (!confirm(`Delete "${venue.name}"?`)) return;
        try {
            const res = await fetch(`/api/locations/${venue._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) { showError(data.error || "Failed to delete location"); return; }
            showSuccess("Location deleted!");
            fetchVenues(orgLocations);
        } catch {
            showError("Failed to delete location");
        }
    };

    return (
        <AdminLayout title="Locations">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage locations.</p>
                </div>
            ) : (
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3>Locations ({venues.length})</h3>
                        <button className="admin-btn admin-btn-primary" onClick={openAddModal} disabled={orgLocations.length === 0}>
                            <i className="fa-solid fa-plus"></i> Add Location
                        </button>
                    </div>

                    {loading ? (
                        <div className="admin-loading">
                            <div className="admin-spinner"></div>
                            Loading locations...
                        </div>
                    ) : orgLocations.length === 0 ? (
                        <div className="admin-empty">
                            <i className="fa-solid fa-location-dot"></i>
                            <p>No operating locations are configured for this organization.</p>
                        </div>
                    ) : venues.length === 0 ? (
                        <div className="admin-empty">
                            <i className="fa-solid fa-location-dot"></i>
                            <p>No locations found. Add your first location.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>State</th>
                                        <th>County</th>
                                        <th>Name</th>
                                        <th>Address</th>
                                        <th>Fields</th>
                                        <th>Manager</th>
                                        <th>Phone</th>
                                        <th style={{ width: 120 }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {venues.map((venue, index) => (
                                        <tr key={venue._id}>
                                            <td>{index + 1}</td>
                                            <td>{venue.stateAbbr || "-"}</td>
                                            <td>{venue.countyName || "-"}</td>
                                            <td style={{ fontWeight: 600 }}>{venue.name}</td>
                                            <td>{venue.address || "-"}</td>
                                            <td>{venue.fieldCount ?? "-"}</td>
                                            <td>{venue.managerName || "-"}</td>
                                            <td>{venue.managerPhone || "-"}</td>
                                            <td>
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => openEditModal(venue)} title="Edit">
                                                        <i className="fa-solid fa-pen"></i>
                                                    </button>
                                                    <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteVenue(venue)} title="Delete">
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
            )}

            <LocationModal
                open={modalOpen}
                editingVenue={editingVenue}
                orgLocations={orgLocations}
                onClose={closeModal}
                onSave={saveVenue}
                loading={modalSaving}
            />
        </AdminLayout>
    );
}
