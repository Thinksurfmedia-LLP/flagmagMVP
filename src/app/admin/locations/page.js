"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import Select from "react-select";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";
import { useToast } from "@/components/AdminToast";
import { US_STATES, US_COUNTIES } from "@/lib/usGeoData";

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

function OrgLocationModal({ open, editingVenue, orgLocations, amenityList, onClose, onSave, loading }) {
    const [selectedState, setSelectedState] = useState(null);
    const [selectedCounty, setSelectedCounty] = useState(null);
    const [selectedCity, setSelectedCity] = useState(null);
    const [venueName, setVenueName] = useState("");
    const [venueAddress, setVenueAddress] = useState("");
    const [managerName, setManagerName] = useState("");
    const [managerPhone, setManagerPhone] = useState("");
    const [fields, setFields] = useState([]);
    const [newFieldName, setNewFieldName] = useState("");
    const [expandedField, setExpandedField] = useState(null);
    const [uploadingIdx, setUploadingIdx] = useState(null);

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

    const cityOptions = useMemo(() => {
        if (!selectedState || !selectedCounty) return [];
        const seen = new Set();
        return orgLocations
            .filter(l => l.stateAbbr === selectedState.value && l.countyName === selectedCounty.value && l.cityName)
            .filter(l => { if (seen.has(l.cityName)) return false; seen.add(l.cityName); return true; })
            .map(l => ({ value: l.cityName, label: l.cityName }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [orgLocations, selectedState, selectedCounty]);

    useEffect(() => {
        if (!open) return;
        if (editingVenue) {
            const state = editingVenue.stateAbbr
                ? { value: editingVenue.stateAbbr, label: `${editingVenue.stateName} (${editingVenue.stateAbbr})`, name: editingVenue.stateName }
                : null;
            const county = editingVenue.countyName ? { value: editingVenue.countyName, label: editingVenue.countyName } : null;
            setSelectedState(state);
            setSelectedCounty(county);
            setSelectedCity(editingVenue.cityName ? { value: editingVenue.cityName, label: editingVenue.cityName } : null);
            setVenueName(editingVenue.name || "");
            setVenueAddress(editingVenue.address || "");
            setManagerName(editingVenue.managerName || "");
            setManagerPhone(editingVenue.managerPhone || "");
            setFields((editingVenue.fields || []).map(f => ({
                name: f.name || "",
                mapEmbed: f.mapEmbed || "",
                amenities: f.amenities || [],
                images: f.images || [],
            })));
            setExpandedField(editingVenue.fields?.length ? 0 : null);
            return;
        }
        setSelectedState(null);
        setSelectedCounty(null);
        setSelectedCity(null);
        setVenueName("");
        setVenueAddress("");
        setManagerName("");
        setManagerPhone("");
        setFields([]);
        setNewFieldName("");
        setExpandedField(null);
    }, [open, editingVenue]);

    if (!open) return null;

    const submit = async (e) => {
        e.preventDefault();
        const cleanFields = fields.map(f => ({
            name: f.name,
            mapEmbed: f.mapEmbed || "",
            amenities: f.amenities || [],
            images: f.images || [],
        }));
        await onSave({
            editingVenue, selectedState, selectedCounty, selectedCity,
            venueName, venueAddress, managerName, managerPhone,
            fields: cleanFields,
        });
    };

    const addField = () => {
        const val = newFieldName.trim();
        if (!val) return;
        const newField = { name: val, mapEmbed: "", amenities: [], images: [] };
        setFields(prev => [...prev, newField]);
        setExpandedField(fields.length);
        setNewFieldName("");
    };

    const removeField = (idx) => {
        setFields(prev => prev.filter((_, i) => i !== idx));
        if (expandedField === idx) setExpandedField(null);
        else if (expandedField > idx) setExpandedField(expandedField - 1);
    };

    const updateField = (idx, key, value) => {
        setFields(prev => prev.map((f, i) => i === idx ? { ...f, [key]: value } : f));
    };

    const toggleFieldAmenity = (idx, amenity) => {
        setFields(prev => prev.map((f, i) => {
            if (i !== idx) return f;
            const has = f.amenities.includes(amenity);
            return { ...f, amenities: has ? f.amenities.filter(a => a !== amenity) : [...f.amenities, amenity] };
        }));
    };

    const uploadFieldImage = async (e, idx) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setUploadingIdx(idx);
        try {
            const urls = [];
            for (const file of files) {
                const formData = new FormData();
                formData.append("file", file);
                const res = await fetch("/api/upload", { method: "POST", body: formData });
                const data = await res.json();
                if (data.success) urls.push(data.url);
            }
            if (urls.length) {
                setFields(prev => prev.map((f, i) => i === idx ? { ...f, images: [...f.images, ...urls] } : f));
            }
        } catch {}
        finally { setUploadingIdx(null); }
        e.target.value = "";
    };

    const removeFieldImage = (fieldIdx, imgIdx) => {
        setFields(prev => prev.map((f, i) => i === fieldIdx ? { ...f, images: f.images.filter((_, j) => j !== imgIdx) } : f));
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 780, maxHeight: "90vh", overflowY: "auto" }}>
                <h3 className="admin-modal-title">{editingVenue ? "Edit Location" : "Add Location"}</h3>
                <form onSubmit={submit}>
                    <div className="admin-form-group">
                        <label className="admin-form-label">State *</label>
                        <Select options={stateOptions} value={selectedState} onChange={opt => { setSelectedState(opt); setSelectedCounty(null); setSelectedCity(null); }} placeholder="Select state..." isClearable isDisabled={Boolean(editingVenue)} styles={selectStyles} menuPortalTarget={typeof document !== "undefined" ? document.body : null} />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">County *</label>
                        <Select options={countyOptions} value={selectedCounty} onChange={opt => { setSelectedCounty(opt); setSelectedCity(null); }} placeholder={selectedState ? "Select county..." : "Select a state first..."} isClearable isDisabled={!selectedState || Boolean(editingVenue)} styles={selectStyles} menuPortalTarget={typeof document !== "undefined" ? document.body : null} />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">City *</label>
                        {cityOptions.length > 0 ? (
                            <Select options={cityOptions} value={selectedCity} onChange={setSelectedCity} placeholder="Select city..." isClearable isDisabled={Boolean(editingVenue)} styles={selectStyles} menuPortalTarget={typeof document !== "undefined" ? document.body : null} />
                        ) : (
                            <div style={{ color: "#8b90a0", fontSize: 13, padding: "8px 0" }}>
                                {selectedCounty ? "No cities configured for this county." : "Select county first..."}
                            </div>
                        )}
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Location Name *</label>
                        <input className="admin-form-input" value={venueName} onChange={e => setVenueName(e.target.value)} placeholder="Location name" required />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Address</label>
                        <input className="admin-form-input" value={venueAddress} onChange={e => setVenueAddress(e.target.value)} placeholder="Street address" />
                    </div>
                    <div className="admin-form-group" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 250px" }}>
                            <label className="admin-form-label">Manager</label>
                            <input className="admin-form-input" value={managerName} onChange={e => setManagerName(e.target.value)} placeholder="Manager" />
                        </div>
                        <div style={{ flex: "1 1 250px" }}>
                            <label className="admin-form-label">Phone Number</label>
                            <input className="admin-form-input" value={managerPhone} onChange={e => setManagerPhone(e.target.value)} placeholder="Phone number" />
                        </div>
                    </div>

                    {/* Fields */}
                    <div className="admin-form-group">
                        <label className="admin-form-label">Fields</label>
                        <div style={{ display: "flex", gap: 8 }}>
                            <input
                                className="admin-form-input"
                                value={newFieldName}
                                onChange={e => setNewFieldName(e.target.value)}
                                placeholder="e.g. 1A, Field 2, Sub1"
                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addField(); } }}
                                style={{ flex: 1 }}
                            />
                            <button type="button" className="admin-btn admin-btn-ghost" onClick={addField} style={{ flexShrink: 0 }}>
                                <i className="fa-solid fa-plus"></i> Add
                            </button>
                        </div>
                    </div>

                    {/* Field Accordions */}
                    {fields.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                            {fields.map((field, idx) => {
                                const isOpen = expandedField === idx;
                                return (
                                    <div key={idx} style={{ border: "1px solid #e8eaef", borderRadius: 8, overflow: "hidden" }}>
                                        {/* Accordion Header */}
                                        <div
                                            style={{
                                                display: "flex", alignItems: "center", justifyContent: "space-between",
                                                padding: "10px 14px", background: isOpen ? "#fff8f7" : "#f9fafb",
                                                cursor: "pointer", userSelect: "none",
                                            }}
                                            onClick={() => setExpandedField(isOpen ? null : idx)}
                                        >
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <i className={`fa-solid fa-chevron-${isOpen ? "down" : "right"}`} style={{ fontSize: 11, color: "#8b90a0", width: 12 }}></i>
                                                <span style={{ fontWeight: 600, fontSize: 14, color: "#1a1d26" }}>{field.name}</span>
                                                <span style={{ fontSize: 12, color: "#8b90a0" }}>
                                                    {field.amenities.length > 0 && `${field.amenities.length} amenities`}
                                                    {field.amenities.length > 0 && field.images.length > 0 && " · "}
                                                    {field.images.length > 0 && `${field.images.length} photos`}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={e => { e.stopPropagation(); removeField(idx); }}
                                                style={{
                                                    background: "none", border: "none", color: "#FF1E00",
                                                    cursor: "pointer", fontSize: 14, padding: "2px 6px",
                                                }}
                                                title="Remove field"
                                            >
                                                <i className="fa-solid fa-trash-can"></i>
                                            </button>
                                        </div>

                                        {/* Accordion Body */}
                                        {isOpen && (
                                            <div style={{ padding: "12px 14px", borderTop: "1px solid #e8eaef", display: "flex", flexDirection: "column", gap: 14 }}>
                                                {/* Google Maps Embed */}
                                                <div>
                                                    <label className="admin-form-label" style={{ marginBottom: 4 }}>Google Maps Embed Code</label>
                                                    <textarea
                                                        className="admin-form-input"
                                                        rows={3}
                                                        value={field.mapEmbed}
                                                        onChange={e => updateField(idx, "mapEmbed", e.target.value)}
                                                        placeholder='Paste Google Maps embed code here (e.g. <iframe src="https://www.google.com/maps/embed?..." ...></iframe>)'
                                                        style={{ fontFamily: "monospace", fontSize: 12 }}
                                                    />
                                                </div>

                                                {/* Amenities */}
                                                <div>
                                                    <label className="admin-form-label" style={{ marginBottom: 4 }}>Amenities</label>
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px" }}>
                                                        {amenityList.map(amenity => (
                                                            <label key={amenity._id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#1a1d26" }}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={field.amenities.includes(amenity.name)}
                                                                    onChange={() => toggleFieldAmenity(idx, amenity.name)}
                                                                    style={{ accentColor: "#FF1E00" }}
                                                                />
                                                                {amenity.icon && <img src={amenity.icon} alt="" style={{ width: 18, height: 18, objectFit: "contain" }} />}
                                                                {amenity.name}
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Photos */}
                                                <div>
                                                    <label className="admin-form-label" style={{ marginBottom: 4 }}>Photos</label>
                                                    {field.images.length > 0 && (
                                                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                                                            {field.images.map((url, imgIdx) => (
                                                                <div key={imgIdx} style={{ position: "relative", width: 72, height: 72 }}>
                                                                    <img
                                                                        src={url}
                                                                        alt={`Photo ${imgIdx + 1}`}
                                                                        style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid #e8eaef" }}
                                                                    />
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeFieldImage(idx, imgIdx)}
                                                                        style={{
                                                                            position: "absolute", top: -6, right: -6,
                                                                            width: 18, height: 18, borderRadius: "50%",
                                                                            background: "#FF1E00", color: "#fff", border: "none",
                                                                            cursor: "pointer", fontSize: 11, lineHeight: "18px",
                                                                            textAlign: "center", padding: 0,
                                                                        }}
                                                                    >&times;</button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <label className="admin-btn admin-btn-ghost" style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                                                        <i className="fa-solid fa-upload"></i>
                                                        {uploadingIdx === idx ? "Uploading..." : "Upload Photo"}
                                                        <input type="file" accept="image/*" multiple onChange={e => uploadFieldImage(e, idx)} disabled={uploadingIdx === idx} style={{ display: "none" }} />
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

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

function OrgLocationsView() {
    const { user, activeRole } = useAuth();
    const { showSuccess, showError } = useToast();

    const effectiveRole = activeRole || user?.role;
    const slug = (user?.roleOrganizations?.[effectiveRole] || user?.organization)?.slug;
    const [orgLocations, setOrgLocations] = useState([]);
    const [venues, setVenues] = useState([]);
    const [amenityList, setAmenityList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalSaving, setModalSaving] = useState(false);
    const [editingVenue, setEditingVenue] = useState(null);

    useEffect(() => {
        if (!slug) return;
        (async () => {
            try {
                const res = await fetch(`/api/organizations/${slug}`);
                const data = await res.json();
                if (data.success) {
                    setOrgLocations((data.data.locations || []).map(l => {
                        if (!l.cityName && l.locationName && l.locationName.includes(',')) {
                            return { ...l, cityName: l.locationName.split(',')[0].trim() };
                        }
                        return l;
                    }));
                }
            } catch {}
        })();
    }, [slug]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/amenities");
                const data = await res.json();
                if (data.success) setAmenityList(data.data || []);
            } catch {}
        })();
    }, []);

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
        } catch { showError("Failed to load locations"); }
        finally { setLoading(false); }
    }, [showError]);

    useEffect(() => {
        if (orgLocations.length > 0) fetchVenues(orgLocations);
        else setLoading(false);
    }, [orgLocations, fetchVenues]);

    const openAddModal = () => { setEditingVenue(null); setModalOpen(true); };
    const openEditModal = (venue) => { setEditingVenue(venue); setModalOpen(true); };
    const closeModal = () => { setModalOpen(false); setEditingVenue(null); };

    const saveVenue = async ({ editingVenue: venue, selectedState, selectedCounty, selectedCity, venueName, venueAddress, managerName, managerPhone, fields }) => {
        if (!venue && (!selectedState || !selectedCounty)) {
            showError("Please select state, county, and city");
            return;
        }
        if (!venueName?.trim()) {
            showError("Location name is required");
            return;
        }
        setModalSaving(true);
        const cleanFields = Array.isArray(fields) ? fields : [];
        try {
            if (venue) {
                const res = await fetch(`/api/locations/${venue._id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: venueName.trim(),
                        address: venueAddress || "",
                        managerName: managerName || "",
                        managerPhone: managerPhone || "",
                        fields: cleanFields,
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
                        cityName: selectedCity?.value || "",
                        venueName: venueName.trim(),
                        venueAddress: venueAddress || "",
                        managerName: managerName || "",
                        managerPhone: managerPhone || "",
                        fields: cleanFields,
                    }),
                });
                const data = await res.json();
                if (!data.success) { showError(data.error || "Failed to add location"); return; }
                showSuccess("Location added!");
            }
            closeModal();
            fetchVenues(orgLocations);
        } catch { showError("Failed to save location"); }
        finally { setModalSaving(false); }
    };

    const deleteVenue = async (venue) => {
        if (!confirm(`Delete "${venue.name}"?`)) return;
        try {
            const res = await fetch(`/api/locations/${venue._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) { showError(data.error || "Failed to delete location"); return; }
            showSuccess("Location deleted!");
            fetchVenues(orgLocations);
        } catch { showError("Failed to delete location"); }
    };

    return (
        <AdminLayout title="Locations">
            <div className="admin-card">
                <div className="admin-card-header">
                    <h3>Locations ({venues.length})</h3>
                    <button className="admin-btn admin-btn-primary" onClick={openAddModal} disabled={orgLocations.length === 0}>
                        <i className="fa-solid fa-plus"></i> Add Location
                    </button>
                </div>

                {loading ? (
                    <div className="admin-loading"><div className="admin-spinner"></div>Loading locations...</div>
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
                                    <th>#</th><th>State</th><th>County</th><th>City</th><th>Name</th><th>Address</th><th>Fields</th><th>Manager</th><th>Phone</th><th style={{ width: 120 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {venues.map((venue, index) => (
                                    <tr key={venue._id}>
                                        <td>{index + 1}</td>
                                        <td>{venue.stateAbbr || "-"}</td>
                                        <td>{venue.countyName || "-"}</td>
                                        <td>{venue.cityName || "-"}</td>
                                        <td style={{ fontWeight: 600 }}>{venue.name}</td>
                                        <td>{venue.address || "-"}</td>
                                        <td>{venue.fields?.length || 0}</td>
                                        <td>{venue.managerName || "-"}</td>
                                        <td>{venue.managerPhone || "-"}</td>
                                        <td>
                                            <div style={{ display: "flex", gap: 6 }}>
                                                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => openEditModal(venue)} title="Edit"><i className="fa-solid fa-pen"></i></button>
                                                <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => deleteVenue(venue)} title="Delete"><i className="fa-solid fa-trash"></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <OrgLocationModal
                open={modalOpen}
                editingVenue={editingVenue}
                orgLocations={orgLocations}
                amenityList={amenityList}
                onClose={closeModal}
                onSave={saveVenue}
                loading={modalSaving}
            />
        </AdminLayout>
    );
}

function VenueModal({ open, editingVenue, onClose, onSave, loading }) {
    const [selectedState, setSelectedState] = useState(null);
    const [selectedCounty, setSelectedCounty] = useState(null);
    const [venueName, setVenueName] = useState("");
    const [venueAddress, setVenueAddress] = useState("");
    const [managerName, setManagerName] = useState("");
    const [managerPhone, setManagerPhone] = useState("");

    const stateOptions = useMemo(
        () => US_STATES.map((s) => ({ value: s.abbr, label: `${s.name} (${s.abbr})`, name: s.name })),
        []
    );

    const countyOptions = useMemo(() => {
        if (!selectedState) return [];
        const list = US_COUNTIES[selectedState.value] || [];
        return list.map((c) => ({ value: c, label: c }));
    }, [selectedState]);

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
            setManagerName(editingVenue.managerName || "");
            setManagerPhone(editingVenue.managerPhone || "");
            return;
        }

        setSelectedState(null);
        setSelectedCounty(null);
        setVenueName("");
        setVenueAddress("");
        setManagerName("");
        setManagerPhone("");
    }, [open, editingVenue]);

    if (!open) return null;

    const submit = async (event) => {
        event.preventDefault();
        await onSave({
            editingVenue,
            selectedState,
            selectedCounty,
            venueName,
            venueAddress,
            managerName,
            managerPhone,
        });
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 720 }}>
                <h3 className="admin-modal-title">{editingVenue ? "Edit Venue" : "Add Venue"}</h3>

                <form onSubmit={submit}>
                    <div className="admin-form-group">
                        <label className="admin-form-label">State *</label>
                        <Select
                            options={stateOptions}
                            value={selectedState}
                            onChange={(opt) => {
                                setSelectedState(opt);
                                setSelectedCounty(null);
                            }}
                            placeholder="Search for a state..."
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
                            placeholder={selectedState ? "Search for a county..." : "Select a state first..."}
                            isClearable
                            isDisabled={!selectedState || Boolean(editingVenue)}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                        />
                    </div>

                    <div className="admin-form-group">
                        <label className="admin-form-label">Venue *</label>
                        <input
                            className="admin-form-input"
                            value={venueName}
                            onChange={(event) => setVenueName(event.target.value)}
                            placeholder="Venue name"
                            required
                        />
                    </div>

                    <div className="admin-form-group">
                        <label className="admin-form-label">Address</label>
                        <input
                            className="admin-form-input"
                            value={venueAddress}
                            onChange={(event) => setVenueAddress(event.target.value)}
                            placeholder="Street address"
                        />
                    </div>

                    <div className="admin-form-group" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 250px" }}>
                            <label className="admin-form-label">Manager</label>
                            <input
                                className="admin-form-input"
                                value={managerName}
                                onChange={(event) => setManagerName(event.target.value)}
                                placeholder="Manager"
                            />
                        </div>
                        <div style={{ flex: "1 1 250px" }}>
                            <label className="admin-form-label">Phone Number</label>
                            <input
                                className="admin-form-input"
                                value={managerPhone}
                                onChange={(event) => setManagerPhone(event.target.value)}
                                placeholder="Phone number"
                            />
                        </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
                        <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose} disabled={loading}>Cancel</button>
                        <button type="submit" className="admin-btn admin-btn-primary" disabled={loading}>
                            {loading ? "Saving..." : editingVenue ? "Update Venue" : "Add Venue"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function AdminVenuesPage() {
    const { user, activeRole } = useAuth();
    const effectiveRole = activeRole || user?.role;

    if (effectiveRole === "organizer") {
        return <OrgLocationsView />;
    }

    return <AdminVenuesView />;
}

function AdminVenuesView() {
    const { user } = useAuth();
    const { showSuccess, showError } = useToast();

    const [venues, setVenues] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalSaving, setModalSaving] = useState(false);
    const [editingVenue, setEditingVenue] = useState(null);

    const canManage = user && hasAccess(user, "manage_organizations");

    const fetchVenues = useCallback(async () => {
        if (!canManage) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/locations");
            const data = await res.json();
            if (!data.success) {
                showError(data.error || "Failed to load venues");
                setVenues([]);
                return;
            }
            setVenues(data.data || []);
        } catch {
            showError("Failed to load venues");
            setVenues([]);
        } finally {
            setLoading(false);
        }
    }, [canManage, showError]);

    useEffect(() => {
        fetchVenues();
    }, [fetchVenues]);

    const openAddModal = () => {
        setEditingVenue(null);
        setModalOpen(true);
    };

    const openEditModal = (venue) => {
        setEditingVenue(venue);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setEditingVenue(null);
    };

    const saveVenue = async ({ editingVenue: venue, selectedState, selectedCounty, venueName, venueAddress, managerName, managerPhone }) => {
        if (!venue && (!selectedState || !selectedCounty)) {
            showError("Please select state and county");
            return;
        }

        if (!venueName?.trim()) {
            showError("Venue name is required");
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
                        managerName: managerName || "",
                        managerPhone: managerPhone || "",
                    }),
                });
                const data = await res.json();
                if (!data.success) {
                    showError(data.error || "Failed to update venue");
                    return;
                }
                showSuccess("Venue updated!");
            } else {
                const res = await fetch("/api/locations/by-geo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        stateAbbr: selectedState.value,
                        stateName: selectedState.name,
                        countyName: selectedCounty.value,
                        venueName: venueName.trim(),
                        venueAddress: venueAddress || "",
                        managerName: managerName || "",
                        managerPhone: managerPhone || "",
                    }),
                });
                const data = await res.json();
                if (!data.success) {
                    showError(data.error || "Failed to add venue");
                    return;
                }
                showSuccess("Venue added!");
            }

            closeModal();
            fetchVenues();
        } catch {
            showError("Failed to save venue");
        } finally {
            setModalSaving(false);
        }
    };

    const deleteVenue = async (venue) => {
        if (!confirm(`Delete "${venue.name}"?`)) return;

        try {
            const res = await fetch(`/api/locations/${venue._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) {
                showError(data.error || "Failed to delete venue");
                return;
            }
            showSuccess("Venue deleted!");
            fetchVenues();
        } catch {
            showError("Failed to delete venue");
        }
    };

    return (
        <AdminLayout title="Venues">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage venues.</p>
                </div>
            ) : (
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3>Venues ({venues.length})</h3>
                        <button className="admin-btn admin-btn-primary" onClick={openAddModal}>
                            <i className="fa-solid fa-plus"></i> Add Venue
                        </button>
                    </div>

                    {loading ? (
                        <div className="admin-loading">
                            <div className="admin-spinner"></div>
                            Loading venues...
                        </div>
                    ) : venues.length === 0 ? (
                        <div className="admin-empty">
                            <i className="fa-solid fa-location-dot"></i>
                            <p>No venues found. Add your first venue.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: "auto" }}>
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>State</th>
                                        <th>County</th>
                                        <th>Venue</th>
                                        <th>Address</th>
                                        <th>Fields</th>
                                        <th>Manager</th>
                                        <th>Phone Number</th>
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
                                            <td>{venue.fields?.length || 0}</td>
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

            <VenueModal
                open={modalOpen}
                editingVenue={editingVenue}
                onClose={closeModal}
                onSave={saveVenue}
                loading={modalSaving}
            />
        </AdminLayout>
    );
}
