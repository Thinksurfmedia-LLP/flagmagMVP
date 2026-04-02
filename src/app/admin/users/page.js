"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";
import Select from "react-select";

function AddUserModal({ onClose, onSave, organizations, roles, isAdmin }) {
    const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
    const [roleOrganizations, setRoleOrganizations] = useState({});
    const [selectedRoles, setSelectedRoles] = useState(isAdmin ? [] : ["free_agent"]);
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [formError, setFormError] = useState("");

    // Admin: elevated roles only — viewer is assigned by default to all users
    // Organizer: only free_agent
    const availableRoles = isAdmin
        ? roles.filter(r => r.slug !== "player" && r.slug !== "viewer" && r.slug !== "admin")
        : roles.filter(r => r.slug === "free_agent");

    const toggleRole = (slug) => {
        setSelectedRoles(prev =>
            prev.includes(slug) ? prev.filter(r => r !== slug) : [...prev, slug]
        );
    };

    const handleSave = async () => {
        setFormError("");
        if (form.password !== form.confirmPassword) { setFormError("Passwords do not match"); return; }
        const effectiveRoles = [...new Set([...(selectedRoles.length > 0 ? selectedRoles : []), "viewer"])];

        if (isAdmin) {
            for (const r of effectiveRoles) {
                if (!["admin", "viewer", "player"].includes(r)) {
                    if (!roleOrganizations[r] || roleOrganizations[r].length === 0) {
                        setFormError(`Please select at least one organization for the ${r.replace(/_/g, " ")} role`);
                        return;
                    }
                }
            }
        }

        setSaving(true);
        await onSave({ ...form, roles: effectiveRoles, role: effectiveRoles[0], roleOrganizations });
        setSaving(false);
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <h3 className="admin-modal-title">Add New User</h3>

                {formError && <div className="admin-alert admin-alert-error" style={{ marginBottom: 12 }}><i className="fa-solid fa-exclamation-circle"></i> {formError}</div>}

                <div className="admin-form-group">
                    <label className="admin-form-label">Name *</label>
                    <input className="admin-form-input" autoComplete="off" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Email *</label>
                    <input type="email" className="admin-form-input" autoComplete="off" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Phone</label>
                    <input className="admin-form-input" autoComplete="off" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1-555-0000" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Password *</label>
                    <div style={{ position: "relative" }}>
                        <input type={showPassword ? "text" : "password"} className="admin-form-input" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" style={{ paddingRight: 36 }} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8b90a0", fontSize: 14 }}>
                            <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                        </button>
                    </div>
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Confirm Password *</label>
                    <div style={{ position: "relative" }}>
                        <input type={showConfirm ? "text" : "password"} className="admin-form-input" autoComplete="new-password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Re-enter password" style={{ paddingRight: 36 }} />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8b90a0", fontSize: 14 }}>
                            <i className={`fa-solid ${showConfirm ? "fa-eye-slash" : "fa-eye"}`}></i>
                        </button>
                    </div>
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Role <span style={{ fontWeight: 400, color: "#8b90a0" }}>(optional — Viewer by default)</span></label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                        {availableRoles.map(r => (
                            <label key={r._id} style={{
                                display: "flex", alignItems: "center", gap: 6,
                                padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                                border: `1.5px solid ${selectedRoles.includes(r.slug) ? "#6366f1" : "#d1d5db"}`,
                                background: selectedRoles.includes(r.slug) ? "rgba(99,102,241,0.1)" : "#f9fafb",
                                color: selectedRoles.includes(r.slug) ? "#6366f1" : "#374151",
                                fontSize: 13, fontWeight: 500, userSelect: "none", transition: "all 0.15s",
                            }}>
                                <input
                                    type="checkbox"
                                    checked={selectedRoles.includes(r.slug)}
                                    onChange={() => toggleRole(r.slug)}
                                    style={{ display: "none" }}
                                />
                                {selectedRoles.includes(r.slug) && <i className="fa-solid fa-check" style={{ fontSize: 11 }}></i>}
                                {r.name || r.slug.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                            </label>
                        ))}
                    </div>
                    {!isAdmin && <p style={{ fontSize: 12, color: "#8b90a0", marginTop: 6 }}>User will be automatically added to your organization.</p>}
                </div>
                {isAdmin && selectedRoles.filter(r => !["admin", "viewer", "player"].includes(r)).map(roleSlug => {
                    const roleName = roles.find(r => r.slug === roleSlug)?.name || roleSlug.replace(/_/g, " ");
                    const currentSelected = roleOrganizations[roleSlug] || [];
                    const selectOptions = (organizations || []).map(o => ({ value: o._id, label: o.name }));
                    const selectValue = selectOptions.filter(o => currentSelected.includes(o.value));

                    return (
                        <div className="admin-form-group" key={roleSlug}>
                            <label className="admin-form-label" style={{ textTransform: "capitalize" }}>{roleName} Organization{roleSlug === 'free_agent' ? 's' : ''} *</label>
                            <Select
                                isMulti={roleSlug === 'free_agent'}
                                className="admin-form-select-multi"
                                classNamePrefix="react-select"
                                options={selectOptions}
                                value={roleSlug === 'free_agent' ? selectValue : (selectValue[0] || null)}
                                onChange={selected => setRoleOrganizations({
                                    ...roleOrganizations,
                                    [roleSlug]: roleSlug === 'free_agent'
                                        ? (selected ? selected.map(s => s.value) : [])
                                        : (selected ? [selected.value] : [])
                                })}
                                placeholder={`— Select Organization${roleSlug === 'free_agent' ? 's' : ''} —`}
                                styles={{
                                    control: (provided) => ({ ...provided, borderColor: '#d1d5db', borderRadius: '8px', padding: '0px', fontSize: '14px', minHeight: '40px' }),
                                    option: (provided, state) => ({ ...provided, color: '#374151', backgroundColor: state.isFocused ? '#f3f4f6' : 'white' }),
                                    multiValueLabel: (provided) => ({ ...provided, color: '#374151' }),
                                    menuPortal: base => ({ ...base, zIndex: 9999 })
                                }}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            />
                        </div>
                    );
                })}

                <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? "Creating..." : "Create User"}
                    </button>
                </div>
            </div>
        </div>
    );
}

function EditUserModal({ target, onClose, onSave, organizations, roles, isAdmin }) {
    const [selectedRoles, setSelectedRoles] = useState(
        target.roles?.length ? target.roles : [target.role]
    );
    const initialRoleOrgs = {};
    for (const [key, val] of Object.entries(target.roleOrganizations || {})) {
        initialRoleOrgs[key] = Array.isArray(val) ? val : (val ? [val] : []);
    }
    const [roleOrganizations, setRoleOrganizations] = useState(initialRoleOrgs);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ name: target.name || "", email: target.email || "", phone: target.phone || "", password: "", confirmPassword: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [formError, setFormError] = useState("");

    const availableRoles = isAdmin
        ? roles.filter(r => !["admin", "player", "viewer"].includes(r.slug))
        : roles.filter(r => !["admin", "organizer"].includes(r.slug));

    const toggleRole = (slug) => {
        setSelectedRoles(prev =>
            prev.includes(slug) ? prev.filter(r => r !== slug) : [...prev, slug]
        );
    };

    const handleSave = async () => {
        setFormError("");
        if (form.password && form.password !== form.confirmPassword) {
            setFormError("Passwords do not match");
            return;
        }
        if (!form.name || !form.email) {
            setFormError("Name and Email are required");
            return;
        }
        if (selectedRoles.length === 0) return;
        setSaving(true);
        const updates = {
            name: form.name,
            email: form.email,
            phone: form.phone,
            roles: selectedRoles,
            role: selectedRoles[0],
            roleOrganizations,
        };
        if (form.password) updates.password = form.password;
        await onSave(target._id, updates);
        setSaving(false);
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={e => e.stopPropagation()}>
                <h3 className="admin-modal-title">Edit User — {target.name}</h3>

                {formError && <div className="admin-alert admin-alert-error" style={{ marginBottom: 12 }}><i className="fa-solid fa-exclamation-circle"></i> {formError}</div>}

                <div className="admin-form-group">
                    <label className="admin-form-label">Name *</label>
                    <input className="admin-form-input" autoComplete="off" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Email *</label>
                    <input type="email" className="admin-form-input" autoComplete="off" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="user@example.com" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Phone</label>
                    <input className="admin-form-input" autoComplete="off" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+1-555-0000" />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">New Password <span style={{ fontWeight: 400, color: "#8b90a0" }}>(Leave blank to keep current)</span></label>
                    <div style={{ position: "relative" }}>
                        <input type={showPassword ? "text" : "password"} className="admin-form-input" autoComplete="new-password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" style={{ paddingRight: 36 }} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8b90a0", fontSize: 14 }}>
                            <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                        </button>
                    </div>
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Confirm New Password</label>
                    <div style={{ position: "relative" }}>
                        <input type={showConfirm ? "text" : "password"} className="admin-form-input" autoComplete="new-password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Re-enter password" style={{ paddingRight: 36 }} />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#8b90a0", fontSize: 14 }}>
                            <i className={`fa-solid ${showConfirm ? "fa-eye-slash" : "fa-eye"}`}></i>
                        </button>
                    </div>
                </div>

                <div className="admin-form-group">
                    <label className="admin-form-label">Roles</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
                        {availableRoles.map(r => (
                            <label key={r._id} style={{
                                display: "flex", alignItems: "center", gap: 6,
                                padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                                border: `1.5px solid ${selectedRoles.includes(r.slug) ? "#6366f1" : "#d1d5db"}`,
                                background: selectedRoles.includes(r.slug) ? "rgba(99,102,241,0.1)" : "#f9fafb",
                                color: selectedRoles.includes(r.slug) ? "#6366f1" : "#374151",
                                fontSize: 13, fontWeight: 500, userSelect: "none", transition: "all 0.15s",
                            }}>
                                <input
                                    type="checkbox"
                                    checked={selectedRoles.includes(r.slug)}
                                    onChange={() => toggleRole(r.slug)}
                                    style={{ display: "none" }}
                                />
                                {selectedRoles.includes(r.slug) && <i className="fa-solid fa-check" style={{ fontSize: 11 }}></i>}
                                {r.name || r.slug.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                            </label>
                        ))}
                    </div>
                </div>

                {isAdmin && selectedRoles.filter(r => !["admin", "viewer", "player"].includes(r)).map(roleSlug => {
                    const roleName = roles.find(r => r.slug === roleSlug)?.name || roleSlug.replace(/_/g, " ");
                    const currentSelected = roleOrganizations[roleSlug] || [];
                    const selectOptions = (organizations || []).map(o => ({ value: o._id, label: o.name }));
                    const selectValue = selectOptions.filter(o => currentSelected.includes(o.value));

                    return (
                        <div className="admin-form-group" key={roleSlug}>
                            <label className="admin-form-label" style={{ textTransform: "capitalize" }}>{roleName} Organization{roleSlug === 'free_agent' ? 's' : ''} *</label>
                            <Select
                                isMulti={roleSlug === 'free_agent'}
                                className="admin-form-select-multi"
                                classNamePrefix="react-select"
                                options={selectOptions}
                                value={roleSlug === 'free_agent' ? selectValue : (selectValue[0] || null)}
                                onChange={selected => setRoleOrganizations({
                                    ...roleOrganizations,
                                    [roleSlug]: roleSlug === 'free_agent'
                                        ? (selected ? selected.map(s => s.value) : [])
                                        : (selected ? [selected.value] : [])
                                })}
                                placeholder={`— Select Organization${roleSlug === 'free_agent' ? 's' : ''} —`}
                                styles={{
                                    control: (provided) => ({ ...provided, borderColor: '#d1d5db', borderRadius: '8px', padding: '0px', fontSize: '14px', minHeight: '40px' }),
                                    option: (provided, state) => ({ ...provided, color: '#374151', backgroundColor: state.isFocused ? '#f3f4f6' : 'white' }),
                                    multiValueLabel: (provided) => ({ ...provided, color: '#374151' }),
                                    menuPortal: base => ({ ...base, zIndex: 9999 })
                                }}
                                menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                            />
                        </div>
                    );
                })}

                <div style={{ marginTop: 12, fontSize: 12, color: "#8b90a0" }}>
                    Permissions are managed in the <strong>Roles</strong> page.
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="admin-btn admin-btn-primary" onClick={handleSave} disabled={saving || selectedRoles.length === 0 || !form.name || !form.email}>
                        {saving ? "Saving..." : "Save Changes"}
                    </button>
                </div>
            </div>
        </div>
    );
}

const USER_CSV_HEADERS = ["name", "email", "phone", "role", "organization"];
const USER_CSV_SAMPLE = [
    ["John Smith", "john@example.com", "555-123-4567", "free_agent", "FlagMag League"],
    ["Jane Doe", "jane@example.com", "555-987-6543", "statistician", "FlagMag League"],
    ["Mike Johnson", "mike@example.com", "", "organizer", "City Sports Org"],
];

function UserCsvImportModal({ onClose, onImportDone }) {
    const { showSuccess, showError } = useToast();
    const fileInputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState(null);
    const [dragOver, setDragOver] = useState(false);

    const downloadTemplate = () => {
        const rows = [
            USER_CSV_HEADERS.join(","),
            ...USER_CSV_SAMPLE.map((r) =>
                r.map((v) => (v.includes(",") ? `"${v}"` : v)).join(",")
            ),
        ];
        const blob = new Blob([rows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "users_import_template.csv";
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
        reader.onload = (e) => setPreview(parseCsvText(e.target.result));
        reader.readAsText(f);
    };

    const handleImport = async () => {
        if (!file) return;
        setImporting(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/admin/import/users", { method: "POST", body: fd });
            const data = await res.json();
            if (!data.success) {
                showError(data.error || "Import failed");
                setImporting(false);
                return;
            }
            setResults(data.data);
            if (data.data.created > 0) {
                showSuccess(`${data.data.created} user(s) imported successfully!`);
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
            <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: "90vh", overflowY: "auto" }}>
                <h3 className="admin-modal-title">
                    <i className="fa-solid fa-file-csv" style={{ color: "#FF1E00", marginRight: 8 }}></i>
                    Import Users from CSV
                </h3>

                {/* Info */}
                {/* <div style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: "#5a5f72" }}>
                    <i className="fa-solid fa-info-circle" style={{ color: "#6366f1", marginRight: 6 }}></i>
                    <strong>Password:</strong> Auto-generated as <code style={{ background: "rgba(0,0,0,0.06)", padding: "1px 5px", borderRadius: 4, fontSize: 11 }}>FIRSTNAME@FLAGMAG{new Date().getFullYear()}</code>
                    <br />
                    <i className="fa-solid fa-shield-halved" style={{ color: "#6366f1", marginRight: 6, marginTop: 4, display: "inline-block" }}></i>
                    <strong>Roles:</strong> free_agent, statistician, organizer, viewer &nbsp;|&nbsp; <strong>Organization:</strong> matched by name (case-insensitive)
                </div> */}

                {/* Step 1 */}
                <div style={{ background: "#f9fafb", border: "1px solid #e8eaef", borderRadius: 8, padding: 14, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1d26", marginBottom: 2 }}>Step 1: Download Template</div>
                            <div style={{ fontSize: 12, color: "#8b90a0" }}>Get a sample CSV with the required columns</div>
                        </div>
                        <button className="admin-btn admin-btn-ghost" onClick={downloadTemplate} style={{ whiteSpace: "nowrap" }}>
                            <i className="fa-solid fa-download"></i> Download Template
                        </button>
                    </div>
                </div>

                {/* Step 2 */}
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
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1d26", marginBottom: 8 }}>Preview ({preview.rows.length} rows)</div>
                        <div style={{ overflowX: "auto", border: "1px solid #e8eaef", borderRadius: 6 }}>
                            <table className="admin-table" style={{ fontSize: 12 }}>
                                <thead>
                                    <tr>{preview.headers.map((h) => <th key={h} style={{ whiteSpace: "nowrap" }}>{h}</th>)}</tr>
                                </thead>
                                <tbody>
                                    {preview.rows.slice(0, 5).map((row, i) => (
                                        <tr key={i}>{row.map((v, j) => <td key={j} style={{ whiteSpace: "nowrap" }}>{v || <span style={{ color: "#ccc" }}>—</span>}</td>)}</tr>
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
                        {/* Show ALL results with passwords for created users */}
                        <div style={{ overflowX: "auto", border: "1px solid #e8eaef", borderRadius: 6 }}>
                            <table className="admin-table" style={{ fontSize: 12 }}>
                                <thead>
                                    <tr><th>Row</th><th>Name</th><th>Status</th><th>Details</th></tr>
                                </thead>
                                <tbody>
                                    {results.details.map((d, i) => (
                                        <tr key={i}>
                                            <td>{d.row}</td>
                                            <td style={{ fontWeight: 500 }}>{d.name}</td>
                                            <td><span style={{ color: statusColor(d.status), fontWeight: 600, fontSize: 11 }}><i className={`fa-solid ${statusIcon(d.status)}`} style={{ marginRight: 4 }}></i>{d.status}</span></td>
                                            <td style={{ color: d.status === "created" ? "#16a34a" : "#5a5f72", fontFamily: d.status === "created" ? "monospace" : "inherit" }}>{d.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>{results ? "Close" : "Cancel"}</button>
                    {!results && (
                        <button className="admin-btn admin-btn-primary" onClick={handleImport} disabled={!file || importing}>
                            {importing ? (<><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Importing...</>) : (<><i className="fa-solid fa-file-import" style={{ marginRight: 6 }}></i>Import Users</>)}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function AdminUsersPage() {
    const { user, activeRole } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editTarget, setEditTarget] = useState(null);
    const [search, setSearch] = useState("");
    const [showAddUser, setShowAddUser] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [organizations, setOrganizations] = useState([]);
    const [roles, setRoles] = useState([]);
    const { showSuccess, showError } = useToast();

    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/users");
            const data = await res.json();
            if (data.success) setUsers(data.data);
            else showError(data.error);
        } catch {
            showError("Failed to load users");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    useEffect(() => {
        fetch("/api/organizations").then(r => r.json()).then(d => {
            if (d.success) setOrganizations(d.data);
        }).catch(() => { });
        fetch("/api/admin/roles").then(r => r.json()).then(d => {
            if (d.success) setRoles(d.data);
        }).catch(() => { });
    }, []);

    const handleSave = async (userId, updates) => {
        try {
            const res = await fetch(`/api/admin/users/${userId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            setEditTarget(null);
            fetchUsers();
            showSuccess("User updated successfully!");
        } catch {
            showError("Failed to update user");
        }
    };

    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase())
    );

    const toggleActive = async (userId, currentActive) => {
        try {
            const res = await fetch(`/api/admin/users/${userId}`, { method: "PATCH" });
            const data = await res.json();
            if (!data.success) { showError(data.error); return; }
            fetchUsers();
            showSuccess(currentActive === false ? "User activated!" : "User deactivated!");
        } catch {
            showError("Failed to update user status");
        }
    };



    const canManage = user && hasAccess(user, "manage_users");

    return (
        <AdminLayout title="Users">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage users.</p>
                </div>
            ) : (
                <>
                    <div className="admin-card">
                        <div className="admin-card-header">
                            <h3>All Users ({filtered.length})</h3>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    placeholder="Search users..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    autoComplete="off"
                                    style={{ maxWidth: 260 }}
                                />
                                {canManage && (
                                    <button className="admin-btn admin-btn-ghost" style={{ whiteSpace: "nowrap" }} onClick={() => setImportModalOpen(true)}>
                                        <i className="fa-solid fa-file-csv"></i> Import CSV
                                    </button>
                                )}
                                {canManage && (
                                    <button className="admin-btn admin-btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => { setSearch(""); setShowAddUser(true); }}>
                                        <i className="fa-solid fa-plus"></i> Add User
                                    </button>
                                )}
                            </div>
                        </div>
                        {loading ? (
                            <div className="admin-loading">
                                <div className="admin-spinner"></div>
                                Loading users...
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-user-slash"></i>
                                <p>No users found.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: "auto" }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Organization</th>
                                            <th>Role</th>
                                            <th>Joined</th>
                                            <th>Status</th>
                                            <th style={{ width: 160 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(u => (
                                            <tr key={u._id} style={{ opacity: u.isActive === false ? 0.5 : 1 }}>
                                                <td style={{ fontWeight: 600 }}>
                                                    {u.name}
                                                    {u.isActive === false && <span className="admin-badge" style={{ marginLeft: 8, background: "#fee2e2", color: "#dc2626" }}>Inactive</span>}
                                                </td>
                                                <td style={{ color: "#5a5f72" }}>{u.email}</td>
                                                <td style={{ color: "#5a5f72", fontSize: 13 }}>
                                                    {(() => {
                                                        const userOrgs = new Set();
                                                        if (u.organization) {
                                                            userOrgs.add(String(u.organization._id || u.organization));
                                                        }
                                                        if (u.roleOrganizations) {
                                                            Object.values(u.roleOrganizations).flat().forEach(orgId => {
                                                                if (orgId) userOrgs.add(String(orgId));
                                                            });
                                                        }
                                                        if (userOrgs.size === 0) return <span style={{ color: "#a0a4b2" }}>—</span>;

                                                        const firstOrgId = Array.from(userOrgs)[0];
                                                        let firstOrgName = firstOrgId;
                                                        if (u.organization && String(u.organization._id || u.organization) === firstOrgId) {
                                                            firstOrgName = u.organization.name || firstOrgId;
                                                        } else {
                                                            const found = organizations.find(o => String(o._id) === firstOrgId);
                                                            if (found) firstOrgName = found.name;
                                                        }

                                                        return (
                                                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                                <span>{firstOrgName}</span>
                                                                {userOrgs.size > 1 && (
                                                                    <span style={{ padding: "2px 6px", fontSize: 11, background: "#f3f4f6", color: "#6b7280", borderRadius: 10, fontWeight: 500 }}>
                                                                        +{userOrgs.size - 1}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td>
                                                    {(u.roles?.length ? u.roles : [u.role]).map(r => (
                                                        <span key={r} className={`admin-badge ${r}`} style={{ marginRight: 4 }}>{r}</span>
                                                    ))}
                                                </td>
                                                <td style={{ color: "#8b90a0", fontSize: 13 }}>
                                                    {new Date(u.createdAt).toLocaleDateString()}
                                                </td>
                                                <td>
                                                    <span className={`admin-badge ${u.isActive === false ? "" : "player"}`}>
                                                        {u.isActive === false ? "Inactive" : "Active"}
                                                    </span>
                                                </td>
                                                <td>
                                                    {canManage && u._id !== user.id && (
                                                        <div style={{ display: "flex", gap: 6 }}>
                                                            <button
                                                                className="admin-btn admin-btn-ghost admin-btn-sm"
                                                                onClick={() => setEditTarget(u)}
                                                                title="Edit role & permissions"
                                                            >
                                                                <i className="fa-solid fa-pen"></i>
                                                            </button>
                                                            <button
                                                                className={`admin-btn admin-btn-sm ${u.isActive === false ? "admin-btn-primary" : "admin-btn-ghost"}`}
                                                                onClick={() => toggleActive(u._id, u.isActive)}
                                                                title={u.isActive === false ? "Activate user" : "Deactivate user"}
                                                            >
                                                                <i className={`fa-solid ${u.isActive === false ? "fa-toggle-off" : "fa-toggle-on"}`}></i>
                                                            </button>

                                                        </div>
                                                    )}
                                                    {canManage && u._id === user.id && (
                                                        <span style={{ fontSize: 12, color: "#8b90a0" }}>You</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {editTarget && (
                        <EditUserModal
                            target={editTarget}
                            onClose={() => setEditTarget(null)}
                            onSave={handleSave}
                            organizations={organizations}
                            roles={roles}
                            isAdmin={(activeRole || user?.role) === "admin"}
                        />
                    )}

                    {showAddUser && (
                        <AddUserModal
                            organizations={organizations}
                            roles={roles}
                            onClose={() => setShowAddUser(false)}
                            isAdmin={(activeRole || user?.role) === "admin"}
                            onSave={async (formData) => {
                                try {
                                    const res = await fetch("/api/admin/users", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify(formData),
                                    });
                                    const data = await res.json();
                                    if (!data.success) { showError(data.error); return; }
                                    setShowAddUser(false);
                                    fetchUsers();
                                    showSuccess("User created successfully!");
                                } catch {
                                    showError("Failed to create user");
                                }
                            }}
                        />
                    )}

                    {importModalOpen && (
                        <UserCsvImportModal
                            onClose={() => setImportModalOpen(false)}
                            onImportDone={() => fetchUsers()}
                        />
                    )}
                </>
            )}
        </AdminLayout>
    );
}
