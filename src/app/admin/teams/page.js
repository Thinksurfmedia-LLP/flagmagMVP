"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import React from "react";
import { US_STATES, US_COUNTIES } from "@/lib/usGeoData";
import AdminLayout, { hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

function ImageUploadField({ value, onChange, placeholder, onError }) {
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

function TeamModal({ team, freeAgents, organizations, user, effectiveRole, onClose, onSave, existingDivisions = [] }) {
    const { showError } = useToast();
    const [name, setName] = useState(team?.name || "");
    const [logo, setLogo] = useState(team?.logo || "");
    const [description, setDescription] = useState(team?.description || "");
    const [coachName, setCoachName] = useState(team?.coachName || "");
    const [coachPhone, setCoachPhone] = useState(team?.coachPhone || "");
    const [division, setDivision] = useState(team?.division || "");
    const [divisionOpen, setDivisionOpen] = useState(false);
    const divisionRef = React.useRef(null);
    const [organization, setOrganization] = useState(
        team?.organization?._id || team?.organization || user?.organization?.id || ""
    );
    const [query, setQuery] = useState("");
    // Track selected players as { player: id, jerseyNumber: num }
    const [selectedPlayers, setSelectedPlayers] = useState(() => {
        return (team?.players || []).map((entry) => ({
            player: String(entry.player?._id || entry.player || entry._id || entry),
            jerseyNumber: entry.jerseyNumber ?? "",
        }));
    });
    const [saving, setSaving] = useState(false);

    // Location picker state
    const [pickerState, setPickerState] = useState(team?.location?.stateAbbr || "");
    const [pickerCounty, setPickerCounty] = useState(team?.location?.countyName || "");
    const [pickerCity, setPickerCity] = useState(team?.location?.cityName || "");
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

    // Pre-fetch cities when editing a team with existing location
    useEffect(() => {
        if (pickerState && pickerCounty) {
            fetchCities(pickerState, pickerCounty);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Merge existing team players with free agents for the candidate list
    const allCandidates = useMemo(() => {
        const existingPlayers = (team?.players || []).map(entry => ({
            ...(entry.player || {}),
            _id: entry.player?._id || entry.player,
            _isExistingTeamPlayer: true,
        }));
        const existingIds = new Set(existingPlayers.map(p => String(p._id)));
        const newFreeAgents = (freeAgents || []).filter(fa => !existingIds.has(String(fa._id)));
        return [...existingPlayers, ...newFreeAgents];
    }, [team, freeAgents]);

    const selectedPlayerIds = selectedPlayers.map(p => p.player);

    const filteredPlayers = allCandidates.filter((player) => {
        const haystack = `${player.name} ${player.organization?.name || ""}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
    });

    const togglePlayer = (playerId) => {
        const id = String(playerId);
        setSelectedPlayers((prev) => {
            const exists = prev.find(p => p.player === id);
            if (exists) {
                return prev.filter(p => p.player !== id);
            }
            return [...prev, { player: id, jerseyNumber: "" }];
        });
    };

    const updateJerseyNumber = (playerId, jerseyNumber) => {
        const id = String(playerId);
        setSelectedPlayers((prev) =>
            prev.map(p => p.player === id ? { ...p, jerseyNumber } : p)
        );
    };

    const handleSave = async () => {
        if (!name.trim()) return;

        // Validate jersey numbers for all selected players
        const missingJersey = selectedPlayers.some(p => p.jerseyNumber === "" || p.jerseyNumber === undefined || p.jerseyNumber === null);
        if (selectedPlayers.length > 0 && missingJersey) {
            showError("Jersey number is required for all players");
            return;
        }

        // Check for duplicate jersey numbers
        const jerseyNums = selectedPlayers.map(p => Number(p.jerseyNumber));
        const uniqueJerseys = new Set(jerseyNums);
        if (uniqueJerseys.size !== jerseyNums.length) {
            showError("Duplicate jersey numbers are not allowed within the same team");
            return;
        }

        setSaving(true);

        const locationPayload = pickerState ? {
            stateName: US_STATES.find((s) => s.abbr === pickerState)?.name || "",
            stateAbbr: pickerState,
            countyName: pickerCounty || "",
            cityName: pickerCity?.trim() || "",
        } : {};

        await onSave({
            name: name.trim(),
            logo: logo.trim(),
            description: description.trim(),
            coachName: coachName.trim(),
            coachPhone: coachPhone.trim(),
            division: division.trim(),
            location: locationPayload,
            organization: effectiveRole === "admin" ? organization : undefined,
            players: selectedPlayers,
        });
        setSaving(false);
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}>
                <h3 className="admin-modal-title">{team ? "Edit Team" : "Create Team"}</h3>

                <div className="admin-form-group">
                    <label className="admin-form-label">Team Name *</label>
                    <input className="admin-form-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Darkside" />
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">Logo (optional)</label>
                    <ImageUploadField
                        value={logo}
                        onChange={setLogo}
                        placeholder="https://... or upload"
                        onError={showError}
                    />
                    {!logo && (
                        <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, color: "#8b90a0", fontSize: 13 }}>
                            <i className="fa-solid fa-shield-halved"></i>
                            A default placeholder will be used
                        </div>
                    )}
                </div>

                {effectiveRole === "admin" && (
                    <div className="admin-form-group">
                        <label className="admin-form-label">Organization *</label>
                        <select className="admin-form-select" value={organization} onChange={(event) => setOrganization(event.target.value)}>
                            <option value="">Select organization</option>
                            {(organizations || []).map((org) => (
                                <option key={org._id} value={org._id}>{org.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="admin-form-group">
                    <label className="admin-form-label">Description (optional)</label>
                    <textarea
                        className="admin-form-input"
                        rows={3}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Brief description of this team..."
                        style={{ resize: "vertical" }}
                    />
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <div className="admin-form-group" style={{ flex: 1, minWidth: 200 }}>
                        <label className="admin-form-label">Coach Name (optional)</label>
                        <input className="admin-form-input" value={coachName} onChange={(e) => setCoachName(e.target.value)} placeholder="e.g. John Smith" />
                    </div>
                    <div className="admin-form-group" style={{ flex: 1, minWidth: 200 }}>
                        <label className="admin-form-label">Coach Phone (optional)</label>
                        <input className="admin-form-input" value={coachPhone} onChange={(e) => setCoachPhone(e.target.value)} placeholder="e.g. 555-123-4567" />
                    </div>
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">Division (optional)</label>
                    <div ref={divisionRef} style={{ position: "relative" }}>
                        <input
                            className="admin-form-input"
                            value={division}
                            onChange={(event) => { setDivision(event.target.value); setDivisionOpen(true); }}
                            onFocus={() => setDivisionOpen(true)}
                            onBlur={() => setTimeout(() => setDivisionOpen(false), 150)}
                            placeholder="e.g. Division A, Open, Competitive"
                            autoComplete="off"
                        />
                        {divisionOpen && (division.trim() || existingDivisions.length > 0) && (() => {
                            const matches = existingDivisions.filter(d => d.toLowerCase().includes(division.toLowerCase().trim()));
                            const isNew = division.trim() && !existingDivisions.some(d => d.toLowerCase() === division.toLowerCase().trim());
                            if (!matches.length && !isNew) return null;
                            return (
                                <div style={{
                                    position: "absolute",
                                    top: "calc(100% + 2px)",
                                    left: 0,
                                    right: 0,
                                    background: "#fff",
                                    border: "1px solid #d5d8e0",
                                    borderRadius: 6,
                                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                                    zIndex: 400,
                                    maxHeight: 180,
                                    overflowY: "auto",
                                }}>
                                    {matches.map(d => (
                                        <div
                                            key={d}
                                            onMouseDown={() => { setDivision(d); setDivisionOpen(false); }}
                                            style={{
                                                padding: "8px 12px",
                                                fontSize: 13,
                                                color: "#1a1d26",
                                                cursor: "pointer",
                                                background: d === division ? "#fff8f7" : "#fff",
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                                            onMouseLeave={e => e.currentTarget.style.background = d === division ? "#fff8f7" : "#fff"}
                                        >
                                            {d}
                                        </div>
                                    ))}
                                    {isNew && (
                                        <div style={{
                                            padding: "8px 12px",
                                            fontSize: 12,
                                            color: "#6b7280",
                                            borderTop: matches.length ? "1px solid #f0f1f5" : "none",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 6,
                                        }}>
                                            <i className="fa-solid fa-circle-info" style={{ color: "#FF1E00" }}></i>
                                            &ldquo;{division.trim()}&rdquo; will be created as a new division
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">Origin Location (optional)</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <select
                            className="admin-form-select"
                            style={{ flex: 1, minWidth: 140 }}
                            value={pickerState}
                            onChange={(e) => {
                                setPickerState(e.target.value);
                                setPickerCounty("");
                                setPickerCity("");
                                setCityOptions([]);
                            }}
                        >
                            <option value="">Select state...</option>
                            {US_STATES.map((s) => (
                                <option key={s.abbr} value={s.abbr}>{s.name} ({s.abbr})</option>
                            ))}
                        </select>
                        <select
                            className="admin-form-select"
                            style={{ flex: 1, minWidth: 140 }}
                            value={pickerCounty}
                            onChange={(e) => {
                                setPickerCounty(e.target.value);
                                setPickerCity("");
                                fetchCities(pickerState, e.target.value);
                            }}
                            disabled={!pickerState}
                        >
                            <option value="">Select county...</option>
                            {(US_COUNTIES[pickerState] || []).map((c) => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        {noCityData ? (
                            <input
                                className="admin-form-input"
                                style={{ flex: 1, minWidth: 140 }}
                                value={pickerCity}
                                onChange={(e) => setPickerCity(e.target.value)}
                                placeholder="City (optional)"
                            />
                        ) : (
                            <select
                                className="admin-form-select"
                                style={{ flex: 1, minWidth: 140 }}
                                value={pickerCity}
                                onChange={(e) => setPickerCity(e.target.value)}
                                disabled={!pickerCounty || loadingCities}
                            >
                                <option value="">{loadingCities ? "Loading cities..." : "Select city..."}</option>
                                {cityOptions.map((c) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">Assign Free Agents</label>
                    <input
                        className="admin-form-input"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search free agents..."
                        style={{ marginBottom: 8 }}
                    />
                    <div className="admin-location-list" style={{ maxHeight: 200 }}>
                        {filteredPlayers.length > 0 ? filteredPlayers.map((player) => {
                            const playerId = String(player._id);
                            const checked = selectedPlayerIds.includes(playerId);
                            const selectedEntry = selectedPlayers.find(p => p.player === playerId);
                            return (
                                <label key={player._id} className={`admin-location-option ${checked ? "selected" : ""}`} style={{ alignItems: "flex-start" }}>
                                    <input type="checkbox" checked={checked} onChange={() => togglePlayer(player._id)} style={{ marginTop: 4 }} />
                                    <span style={{ flex: 1 }}>
                                        <strong>{player.name}</strong>
                                        {player._isExistingTeamPlayer ? (
                                            <small style={{ color: "#22c55e" }}>Currently on this team</small>
                                        ) : (
                                            <small>Free Agent{player.organization?.name ? ` — ${player.organization.name}` : ""}</small>
                                        )}
                                    </span>
                                    {checked && (
                                        <input
                                            type="number"
                                            className="admin-form-input"
                                            value={selectedEntry?.jerseyNumber ?? ""}
                                            onChange={(e) => updateJerseyNumber(playerId, e.target.value)}
                                            placeholder="#"
                                            onClick={(e) => e.stopPropagation()}
                                            style={{ width: 64, padding: "4px 8px", fontSize: 13, textAlign: "center", marginLeft: 8, flexShrink: 0 }}
                                            min="0"
                                            max="99"
                                        />
                                    )}
                                </label>
                            );
                        }) : (
                            <div style={{ color: "#8b90a0", fontSize: 13, padding: 8 }}>No matching free agents.</div>
                        )}
                    </div>
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Cancel</button>
                    <button
                        className="admin-btn admin-btn-primary"
                        onClick={handleSave}
                        disabled={saving || !name.trim() || (effectiveRole === "admin" && !organization)}
                    >
                        {saving ? "Saving..." : team ? "Save Changes" : "Create Team"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const TEAM_CSV_HEADERS = ["name", "division", "description", "coachName", "coachPhone", "stateName", "stateAbbr", "countyName", "cityName"];
const TEAM_CSV_SAMPLE = [
    ["Red Dragons", "Men's A", "Est. 2022", "John Smith", "555-123-4567", "California", "CA", "Los Angeles", "Pasadena"],
    ["Blue Hawks", "Men's A", "", "Jane Doe", "555-987-6543", "California", "CA", "Orange", "Irvine"],
    ["Gold Tigers", "Women's B", "Defending champs", "", "", "Texas", "TX", "Harris", "Houston"],
];

function CsvImportModal({ onClose, onImportDone }) {
    const { showSuccess, showError } = useToast();
    const fileInputRef = React.useRef(null);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState(null);
    const [dragOver, setDragOver] = useState(false);

    const downloadTemplate = () => {
        const rows = [TEAM_CSV_HEADERS.join(","), ...TEAM_CSV_SAMPLE.map((r) => r.map((v) => (v.includes(",") ? `"${v}"` : v)).join(","))];
        const blob = new Blob([rows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "teams_import_template.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    const parseCsvText = (text) => {
        const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
        if (lines.length < 2) return null;
        const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
        const rows = lines.slice(1).map((line) => {
            const vals = [];
            let current = "";
            let inQuotes = false;
            for (let i = 0; i < line.length; i++) {
                if (line[i] === '"') { inQuotes = !inQuotes; }
                else if (line[i] === "," && !inQuotes) { vals.push(current.trim()); current = ""; }
                else { current += line[i]; }
            }
            vals.push(current.trim());
            return vals;
        });
        return { headers, rows };
    };

    const handleFile = (f) => {
        if (!f || !f.name.endsWith(".csv")) {
            showError("Please select a .csv file");
            return;
        }
        setFile(f);
        setResults(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            const parsed = parseCsvText(e.target.result);
            setPreview(parsed);
        };
        reader.readAsText(f);
    };

    const handleImport = async () => {
        if (!file) return;
        setImporting(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/admin/import/teams", { method: "POST", body: fd });
            const data = await res.json();
            if (!data.success) {
                showError(data.error || "Import failed");
                setImporting(false);
                return;
            }
            setResults(data.data);
            if (data.data.created > 0) {
                showSuccess(`${data.data.created} team(s) imported successfully!`);
                onImportDone();
            }
        } catch {
            showError("Import failed");
        } finally {
            setImporting(false);
        }
    };

    const statusColor = (s) => s === "created" ? "#16a34a" : s === "skipped" ? "#f59e0b" : "#dc2626";
    const statusIcon = (s) => s === "created" ? "fa-check-circle" : s === "skipped" ? "fa-forward" : "fa-times-circle";

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, maxHeight: "90vh", overflowY: "auto" }}>
                <h3 className="admin-modal-title">
                    <i className="fa-solid fa-file-csv" style={{ color: "#FF1E00", marginRight: 8 }}></i>
                    Import Teams from CSV
                </h3>

                {/* Step 1: Download template */}
                <div style={{ background: "#f9fafb", border: "1px solid #e8eaef", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1d26", marginBottom: 2 }}>Step 1: Download Template</div>
                            <div style={{ fontSize: 12, color: "#8b90a0" }}>Get a sample CSV with the correct column headers</div>
                        </div>
                        <button className="admin-btn admin-btn-ghost" onClick={downloadTemplate} style={{ whiteSpace: "nowrap" }}>
                            <i className="fa-solid fa-download"></i> Download Template
                        </button>
                    </div>
                    {/* <div style={{ marginTop: 10, fontSize: 11, color: "#8b90a0" }}>
                        <strong>Required:</strong> name &nbsp;|&nbsp; <strong>Optional:</strong> division, description, stateName, stateAbbr, countyName, cityName
                    </div> */}
                </div>

                {/* Step 2: Upload */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1d26", marginBottom: 8 }}>Step 2: Upload your CSV</div>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
                        style={{
                            border: `2px dashed ${dragOver ? "#FF1E00" : "#d5d8e0"}`,
                            borderRadius: 8,
                            padding: "28px 20px",
                            textAlign: "center",
                            cursor: "pointer",
                            background: dragOver ? "rgba(255,30,0,0.03)" : "#fff",
                            transition: "all 0.2s ease",
                        }}
                    >
                        <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: 28, color: dragOver ? "#FF1E00" : "#a0a4b2", marginBottom: 8, display: "block" }}></i>
                        <div style={{ fontSize: 13, color: "#5a5f72", fontWeight: 500 }}>
                            {file ? (<><i className="fa-solid fa-file-csv" style={{ color: "#16a34a", marginRight: 6 }}></i>{file.name}</>) : "Drag & drop a CSV file here, or click to browse"}
                        </div>
                        {file && <div style={{ fontSize: 11, color: "#8b90a0", marginTop: 4 }}>Click to change file</div>}
                    </div>
                    <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
                </div>

                {/* Preview */}
                {preview && !results && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1d26", marginBottom: 8 }}>Preview ({preview.rows.length} rows found)</div>
                        <div style={{ overflowX: "auto", border: "1px solid #e8eaef", borderRadius: 6 }}>
                            <table className="admin-table" style={{ fontSize: 12 }}>
                                <thead>
                                    <tr>{preview.headers.map((h) => <th key={h}>{h}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {preview.rows.slice(0, 5).map((row, i) => (
                                        <tr key={i}>{row.map((v, j) => <td key={j}>{v || <span style={{ color: "#ccc" }}>—</span>}</td>)}</tr>
                                    ))}
                                    {preview.rows.length > 5 && (
                                        <tr><td colSpan={preview.headers.length} style={{ textAlign: "center", color: "#8b90a0", fontStyle: "italic" }}>... and {preview.rows.length - 5} more rows</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Results */}
                {results && (
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1d26", marginBottom: 10 }}>Import Results</div>
                        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                            <div style={{ flex: 1, minWidth: 100, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, padding: "10px 14px", textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: "#16a34a" }}>{results.created}</div>
                                <div style={{ fontSize: 11, color: "#16a34a" }}>Created</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 100, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 6, padding: "10px 14px", textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: "#f59e0b" }}>{results.skipped}</div>
                                <div style={{ fontSize: 11, color: "#f59e0b" }}>Skipped</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 100, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 6, padding: "10px 14px", textAlign: "center" }}>
                                <div style={{ fontSize: 22, fontWeight: 700, color: "#dc2626" }}>{results.errors}</div>
                                <div style={{ fontSize: 11, color: "#dc2626" }}>Errors</div>
                            </div>
                        </div>
                        {results.details.filter((d) => d.status !== "created").length > 0 && (
                            <div style={{ overflowX: "auto", border: "1px solid #e8eaef", borderRadius: 6 }}>
                                <table className="admin-table" style={{ fontSize: 12 }}>
                                    <thead>
                                        <tr><th>Row</th><th>Name</th><th>Status</th><th>Reason</th></tr>
                                    </thead>
                                    <tbody>
                                        {results.details.filter((d) => d.status !== "created").map((d, i) => (
                                            <tr key={i}>
                                                <td>{d.row}</td>
                                                <td style={{ fontWeight: 500 }}>{d.name}</td>
                                                <td><span style={{ color: statusColor(d.status), fontWeight: 600, fontSize: 11 }}><i className={`fa-solid ${statusIcon(d.status)}`} style={{ marginRight: 4 }}></i>{d.status}</span></td>
                                                <td style={{ color: "#5a5f72" }}>{d.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>{results ? "Close" : "Cancel"}</button>
                    {!results && (
                        <button className="admin-btn admin-btn-primary" onClick={handleImport} disabled={!file || importing}>
                            {importing ? (<><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Importing...</>) : (<><i className="fa-solid fa-file-import" style={{ marginRight: 6 }}></i>Import Teams</>)}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AdminTeamsPage() {
    const { user, activeRole } = useAuth();
    const effectiveRole = activeRole || user?.role;
    const { showSuccess, showError } = useToast();

    const [teams, setTeams] = useState([]);
    const [freeAgents, setFreeAgents] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [importModalOpen, setImportModalOpen] = useState(false);

    const canView = hasAnyAccess(user, [
        "manage_teams", "team_view", "team_create", "team_update", "team_delete",
        "manage_players", "player_view", "player_update",
        "manage_organizations", "organization_update",
    ]);
    const canCreate = hasAnyAccess(user, ["manage_teams", "team_create"]);
    const canUpdate = hasAnyAccess(user, ["manage_teams", "team_update"]);
    const canDelete = hasAnyAccess(user, ["manage_teams", "team_delete"]);

    const fetchData = useCallback(async () => {
        if (!canView) {
            setLoading(false);
            return;
        }

        try {
            const [teamsRes, freeAgentsRes] = await Promise.all([
                fetch("/api/teams"),
                fetch("/api/free-agents"),
            ]);
            const [teamsData, freeAgentsData] = await Promise.all([teamsRes.json(), freeAgentsRes.json()]);

            if (teamsData.success) setTeams(teamsData.data || []);
            else showError(teamsData.error || "Failed to load teams");

            if (freeAgentsData.success) setFreeAgents(freeAgentsData.data || []);
            else showError(freeAgentsData.error || "Failed to load free agents");

            if (effectiveRole === "admin") {
                const orgRes = await fetch("/api/organizations");
                const orgData = await orgRes.json();
                if (orgData.success) setOrganizations(orgData.data || []);
            }
        } catch {
            showError("Failed to load teams and free agents");
        } finally {
            setLoading(false);
        }
    }, [canView, showError, effectiveRole]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const saveTeam = async (payload) => {
        try {
            const isEdit = Boolean(editTarget);
            const res = await fetch(isEdit ? `/api/teams/${editTarget._id}` : "/api/teams", {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!data.success) {
                showError(data.error || "Failed to save team");
                return;
            }

            setModalOpen(false);
            setEditTarget(null);
            fetchData();
            showSuccess(isEdit ? "Team updated!" : "Team created!");
        } catch {
            showError("Failed to save team");
        }
    };

    const deleteTeam = async (team) => {
        if (!confirm(`Delete team "${team.name}"?`)) return;

        try {
            const res = await fetch(`/api/teams/${team._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) {
                showError(data.error || "Failed to delete team");
                return;
            }
            fetchData();
            showSuccess("Team deleted!");
        } catch {
            showError("Failed to delete team");
        }
    };

    return (
        <AdminLayout title="Teams">
            {!canView ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage teams.</p>
                </div>
            ) : (
                <>
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3>Teams ({teams.length})</h3>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                {canCreate && (
                                    <button className="admin-btn admin-btn-ghost" onClick={() => setImportModalOpen(true)}>
                                        <i className="fa-solid fa-file-csv"></i> Import CSV
                                    </button>
                                )}
                                {canCreate && (
                                    <button className="admin-btn admin-btn-primary" onClick={() => { setEditTarget(null); setModalOpen(true); }}>
                                        <i className="fa-solid fa-plus"></i> Create Team
                                    </button>
                                )}
                            </div>
                        </div>

                        {loading ? (
                            <div className="admin-loading">
                                <div className="admin-spinner"></div>
                                Loading teams...
                            </div>
                        ) : teams.length === 0 ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-people-group"></i>
                                <p>No teams yet. Create one and assign players.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Team</th>
                                            <th>Organization</th>
                                            <th>Players</th>
                                            <th style={{ width: 130 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teams.map((team) => (
                                            <tr key={team._id}>
                                                <td style={{ fontWeight: 600 }}>{team.name}</td>
                                                <td>{team.organization?.name || "—"}</td>
                                                <td>{team.players?.length || 0}</td>
                                                <td>
                                                    <div style={{ display: "flex", gap: 6 }}>
                                                        {canUpdate && (
                                                            <button
                                                                className="admin-btn admin-btn-ghost admin-btn-sm"
                                                                onClick={() => { setEditTarget(team); setModalOpen(true); }}
                                                                title="Edit"
                                                            >
                                                                <i className="fa-solid fa-pen"></i>
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                className="admin-btn admin-btn-danger admin-btn-sm"
                                                                onClick={() => deleteTeam(team)}
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

                    {modalOpen && (
                        <TeamModal
                            team={editTarget}
                            freeAgents={freeAgents}
                            organizations={organizations}
                            user={user}
                            effectiveRole={effectiveRole}
                            existingDivisions={[...new Set(teams.map(t => t.division).filter(Boolean))]}
                            onClose={() => { setModalOpen(false); setEditTarget(null); }}
                            onSave={saveTeam}
                        />
                    )}

                    {importModalOpen && (
                        <CsvImportModal
                            onClose={() => setImportModalOpen(false)}
                            onImportDone={() => fetchData()}
                        />
                    )}
                </>
            )}
        </AdminLayout>
    );
}
