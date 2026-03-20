"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import React from "react";
import Link from "next/link";
import { US_STATES, US_COUNTIES } from "@/lib/usGeoData";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

const CATEGORY_OPTIONS = ["Men", "Youth", "Women", "Coed"];
const SCHEDULE_DAY_OPTIONS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function ImageUploadField({ label, value, onChange, placeholder, onError }) {
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

function OrgForm({ org, onSave, onCancel }) {
    const { showError } = useToast();
    const [form, setForm] = useState(
        org || {
            name: "", slug: "", description: "", location: "",
            sport: "Flag Football", memberCount: 0,
            foundedYear: new Date().getFullYear(), categories: [], scheduleDays: [], locations: [],
            logo: "", bannerImage: "",
            contactInfo: { phone: "", email: "", website: "" },
            socialLinks: { facebook: "", twitter: "", instagram: "" },
        }
    );
    const [selectedCategories, setSelectedCategories] = useState(org?.categories || []);
    const [selectedDays, setSelectedDays] = useState(org?.scheduleDays || []);
    const [selectedLocations, setSelectedLocations] = useState(() => {
        return (org?.locations || []).map(l => {
            if (!l.cityName && l.locationName && l.locationName.includes(',')) {
                return { ...l, cityName: l.locationName.split(',')[0].trim() };
            }
            return l;
        });
    });
    const [pickerState, setPickerState] = useState("");
    const [pickerCounty, setPickerCounty] = useState("");
    const [pickerCity, setPickerCity] = useState("");
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

    const addLocation = () => {
        if (!pickerState || !pickerCounty) return;
        if (selectedLocations.some(l => l.stateAbbr === pickerState && l.countyName === pickerCounty && l.cityName === pickerCity)) return;
        const stateObj = US_STATES.find(s => s.abbr === pickerState);
        const cityLabel = pickerCity.trim();
        setSelectedLocations(prev => [...prev, {
            state: null,
            county: null,
            location: null,
            stateName: stateObj.name,
            stateAbbr: stateObj.abbr,
            countyName: pickerCounty,
            cityName: cityLabel,
            locationName: cityLabel
                ? `${cityLabel}, ${pickerCounty} (${stateObj.abbr})`
                : `${pickerCounty} (${stateObj.abbr})`,
        }]);
        setPickerCity("");
    };

    const removeLocation = (stateAbbr, countyName, cityName) => {
        setSelectedLocations(prev => prev.filter(l => !(l.stateAbbr === stateAbbr && l.countyName === countyName && l.cityName === cityName)));
    };

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

    const handleSubmit = (e) => {
        e.preventDefault();

        if (selectedCategories.length === 0) {
            showError("Please select at least one category.");
            return;
        }

        if (selectedDays.length === 0) {
            showError("Please select at least one schedule day.");
            return;
        }

        if (selectedLocations.length === 0) {
            showError("Please select at least one operating location.");
            return;
        }

        const locationNames = selectedLocations.map((entry) => entry.locationName || entry.countyName).filter(Boolean);
        onSave({
            ...form,
            categories: selectedCategories,
            scheduleDays: selectedDays,
            locations: selectedLocations,
            location: locationNames.join(", "),
        });
    };

    return (
        <div className="admin-inline-form">
            <form onSubmit={handleSubmit}>
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
                        <label className="admin-form-label">Logo</label>
                        <ImageUploadField value={form.logo || ""} onChange={v => setForm({ ...form, logo: v })} placeholder="https://... or upload" onError={showError} />
                    </div>
                    <div className="admin-form-group" style={{ gridColumn: "span 2" }}>
                        <label className="admin-form-label">Cover Photo</label>
                        <ImageUploadField value={form.bannerImage || ""} onChange={v => setForm({ ...form, bannerImage: v })} placeholder="https://... or upload" onError={showError} />
                    </div>

                    <div className="admin-form-group">
                        <label className="admin-form-label">Website</label>
                        <input className="admin-form-input" value={form.contactInfo?.website || ""} onChange={e => setForm({ ...form, contactInfo: { ...form.contactInfo, website: e.target.value } })} placeholder="https://..." />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Email</label>
                        <input type="email" className="admin-form-input" value={form.contactInfo?.email || ""} onChange={e => setForm({ ...form, contactInfo: { ...form.contactInfo, email: e.target.value } })} placeholder="contact@example.com" />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Facebook</label>
                        <input className="admin-form-input" value={form.socialLinks?.facebook || ""} onChange={e => setForm({ ...form, socialLinks: { ...form.socialLinks, facebook: e.target.value } })} placeholder="https://facebook.com/..." />
                    </div>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Instagram</label>
                        <input className="admin-form-input" value={form.socialLinks?.instagram || ""} onChange={e => setForm({ ...form, socialLinks: { ...form.socialLinks, instagram: e.target.value } })} placeholder="https://instagram.com/..." />
                    </div>
                    <div className="admin-form-group" style={{ gridColumn: "span 2" }}>
                        <label className="admin-form-label">Twitter / X</label>
                        <input className="admin-form-input" value={form.socialLinks?.twitter || ""} onChange={e => setForm({ ...form, socialLinks: { ...form.socialLinks, twitter: e.target.value } })} placeholder="https://x.com/..." />
                    </div>

                    <div className="admin-form-group">
                        <label className="admin-form-label">Categories *</label>
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
                        <label className="admin-form-label">Schedule Days *</label>
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
                        <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                            <select
                                className="admin-form-select"
                                style={{ flex: 1, minWidth: 160 }}
                                value={pickerState}
                                onChange={e => { setPickerState(e.target.value); setPickerCounty(""); setPickerCity(""); setCityOptions([]); }}
                            >
                                <option value="">Select state...</option>
                                {US_STATES.map(s => (
                                    <option key={s.abbr} value={s.abbr}>{s.name} ({s.abbr})</option>
                                ))}
                            </select>
                            <select
                                className="admin-form-select"
                                style={{ flex: 1, minWidth: 160 }}
                                value={pickerCounty}
                                onChange={e => { setPickerCounty(e.target.value); setPickerCity(""); fetchCities(pickerState, e.target.value); }}
                                disabled={!pickerState}
                            >
                                <option value="">Select county...</option>
                                {(US_COUNTIES[pickerState] || []).map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            {noCityData ? (
                                <input
                                    className="admin-form-input"
                                    style={{ flex: 1, minWidth: 160 }}
                                    value={pickerCity}
                                    onChange={e => setPickerCity(e.target.value)}
                                    placeholder="City (optional)"
                                />
                            ) : (
                                <select
                                    className="admin-form-select"
                                    style={{ flex: 1, minWidth: 160 }}
                                    value={pickerCity}
                                    onChange={e => setPickerCity(e.target.value)}
                                    disabled={!pickerCounty || loadingCities}
                                >
                                    <option value="">{loadingCities ? "Loading cities..." : "Select city..."}</option>
                                    {cityOptions.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            )}
                            <button
                                type="button"
                                className="admin-btn admin-btn-primary"
                                style={{ whiteSpace: "nowrap" }}
                                onClick={addLocation}
                                disabled={!pickerState || !pickerCounty || (!noCityData && !pickerCity)}
                            >
                                Add
                            </button>
                        </div>
                        {selectedLocations.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {selectedLocations.map((loc, i) => (
                                    <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,30,0,0.08)", color: "#FF1E00", fontWeight: 600, fontSize: 13, borderRadius: 999, padding: "4px 10px" }}>
                                        {loc.locationName || (`${loc.cityName ? `${loc.cityName}, ` : ""}${loc.countyName} (${loc.stateAbbr || loc.stateName})`)}
                                        <button
                                            type="button"
                                            onClick={() => removeLocation(loc.stateAbbr, loc.countyName, loc.cityName)}
                                            style={{ background: "none", border: "none", cursor: "pointer", color: "#FF1E00", padding: 0, fontSize: 16, lineHeight: 1 }}
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
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

export default function AdminOrganizationsPage() {
    const { user } = useAuth();
    const [orgs, setOrgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showOrgForm, setShowOrgForm] = useState(false);
    const [editOrg, setEditOrg] = useState(null);
    const { showSuccess, showError } = useToast();

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
        showSuccess(isEdit ? "Organization updated!" : "Organization created!");
    };

    const deleteOrg = async (slug) => {
        if (!confirm("Delete this organization? This cannot be undone.")) return;
        const res = await fetch(`/api/organizations/${slug}`, { method: "DELETE" });
        const data = await res.json();
        if (!data.success) { showError(data.error); return; }
        fetchOrgs(); showSuccess("Organization deleted!");
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
                                                <th>Seasons</th>
                                                <th>Leagues</th>
                                                <th>Players</th>
                                                <th style={{ width: 120 }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {orgs.map(org => (
                                                <Fragment key={org._id}>
                                                    <tr>
                                                        <td><strong>{org.name}</strong></td>
                                                        <td>{org.sport}</td>
                                                        <td>
                                                            {[...new Set((org.locations || []).map(l => `${l.countyName} (${l.stateAbbr})`).filter(Boolean))].join(", ") || org.location || "—"}
                                                        </td>
                                                        <td>{org.seasonCount ?? 0}</td>
                                                        <td>{org.leagueCount ?? 0}</td>
                                                        <td>{org.playerCount ?? 0}</td>
                                                        <td>
                                                            <div style={{ display: "flex", gap: 6 }}>
                                                                <button className="admin-btn admin-btn-ghost admin-btn-sm" title="Edit" onClick={() => { setEditOrg(org); setShowOrgForm(true); }}>
                                                                    <i className="fa-solid fa-pen"></i>
                                                                </button>
                                                                <Link href={`/organizations/${org.slug}`} className="admin-btn admin-btn-ghost admin-btn-sm" title="View">
                                                                    <i className="fa-solid fa-eye"></i>
                                                                </Link>
                                                                <button className="admin-btn admin-btn-danger admin-btn-sm" title="Delete" onClick={() => deleteOrg(org.slug)}>
                                                                    <i className="fa-solid fa-trash"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {editOrg && editOrg.slug === org.slug && (
                                                        <tr><td colSpan={6} style={{ padding: "0 16px 16px" }}>
                                                            <OrgForm org={editOrg} onSave={saveOrg} onCancel={() => { setEditOrg(null); setShowOrgForm(false); }} />
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
