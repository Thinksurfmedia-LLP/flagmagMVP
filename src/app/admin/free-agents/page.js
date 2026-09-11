"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AdminLayout, { hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

const FA_CSV_HEADERS = ["name", "email", "password", "phone"];
const FA_CSV_SAMPLE = [
    ["Jordan Lee", "jordan.lee@example.com", "changeme123", "555-201-4477"],
    ["Casey Rivera", "casey.rivera@example.com", "changeme123", ""],
];

// Same shape as the CsvImportModal in admin/teams/page.js (download template
// → drag/drop upload → preview → import → per-row results) — duplicated
// rather than shared since each admin page already owns its import modal
// independently in this codebase, and the two forms' fields don't overlap.
function CsvImportModal({ onClose, onImportDone }) {
    const { showSuccess, showError } = useToast();
    const fileInputRef = useRef(null);
    const [file, setFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState(null);
    const [dragOver, setDragOver] = useState(false);

    const downloadTemplate = () => {
        const rows = [FA_CSV_HEADERS.join(","), ...FA_CSV_SAMPLE.map((r) => r.map((v) => (v.includes(",") ? `"${v}"` : v)).join(","))];
        const blob = new Blob([rows.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "free_agents_import_template.csv";
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
            const res = await fetch("/api/admin/import/free-agents", { method: "POST", body: fd });
            const data = await res.json();
            if (!data.success) {
                showError(data.error || "Import failed");
                setImporting(false);
                return;
            }
            setResults(data.data);
            if (data.data.created > 0) {
                showSuccess(`${data.data.created} free agent(s) imported successfully!`);
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
        <div className="admin-modal-backdrop">
            <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, maxHeight: "90vh", overflowY: "auto" }}>
                <button className="admin-modal-close" onClick={onClose} aria-label="Close">
                    <i className="fa-solid fa-xmark"></i>
                </button>
                <h3 className="admin-modal-title">
                    <i className="fa-solid fa-file-csv" style={{ color: "#FF1E00", marginRight: 8 }}></i>
                    Import Free Agents from CSV
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
                    <div style={{ marginTop: 10, fontSize: 11, color: "#8b90a0" }}>
                        <strong>Required:</strong> name, email, password &nbsp;|&nbsp; <strong>Optional:</strong> phone
                    </div>
                    <div style={{ marginTop: 6, fontSize: 11, color: "#8b90a0" }}>
                        Each new email creates a login account — passwords aren&apos;t emailed, share them separately. Reusing an email (e.g. a parent registering multiple kids) adds another free agent under that same login instead of a new account; its password column is ignored.
                    </div>
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
                                        <tr key={i}>
                                            {row.map((v, j) => (
                                                <td key={j}>
                                                    {preview.headers[j] === "password"
                                                        ? (v ? "••••••••" : <span style={{ color: "#ccc" }}>—</span>)
                                                        : (v || <span style={{ color: "#ccc" }}>—</span>)}
                                                </td>
                                            ))}
                                        </tr>
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
                            {importing ? (<><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Importing...</>) : (<><i className="fa-solid fa-file-import" style={{ marginRight: 6 }}></i>Import Free Agents</>)}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

function AddFreeAgentModal({ onClose, onSave, organizations, isAdmin }) {
    const [organization, setOrganization] = useState("");
    const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirmPassword: "" });
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handleSave = async () => {
        setFormError("");
        if (isAdmin && !organization) {
            setFormError("Please select an organization");
            return;
        }
        if (!form.name || !form.email || !form.password) {
            setFormError("Name, email, and password are required");
            return;
        }
        if (form.password.length < 6) {
            setFormError("Password must be at least 6 characters");
            return;
        }
        if (form.password !== form.confirmPassword) {
            setFormError("Passwords do not match");
            return;
        }
        setSaving(true);
        await onSave({
            name: form.name,
            email: form.email,
            phone: form.phone,
            password: form.password,
            organization: isAdmin ? organization : undefined,
        });
        setSaving(false);
    };

    return (
        <div className="admin-modal-backdrop">
            <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
                <button className="admin-modal-close" onClick={onClose} aria-label="Close">
                    <i className="fa-solid fa-xmark"></i>
                </button>
                <h3 className="admin-modal-title">Add Free Agent</h3>

                {formError && (
                    <div className="admin-alert admin-alert-error" style={{ marginBottom: 12 }}>
                        <i className="fa-solid fa-exclamation-circle"></i> {formError}
                    </div>
                )}

                {/* Organization (admin only) */}
                {isAdmin && (
                    <div className="admin-form-group">
                        <label className="admin-form-label">Organization *</label>
                        <select
                            className="admin-form-select"
                            value={organization}
                            onChange={(e) => setOrganization(e.target.value)}
                        >
                            <option value="">Select organization...</option>
                            {(organizations || []).map((o) => (
                                <option key={o._id} value={o._id}>{o.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="admin-form-group">
                    <label className="admin-form-label">Name *</label>
                    <input
                        className="admin-form-input"
                        autoComplete="off"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Full name"
                    />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Email *</label>
                    <input
                        type="email"
                        className="admin-form-input"
                        autoComplete="off"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        placeholder="user@example.com"
                    />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Phone</label>
                    <input
                        className="admin-form-input"
                        autoComplete="off"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="+1-555-0000"
                    />
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Password *</label>
                    <div style={{ position: "relative" }}>
                        <input
                            type={showPassword ? "text" : "password"}
                            className="admin-form-input"
                            autoComplete="new-password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            placeholder="Min 6 characters"
                            style={{ paddingRight: 36 }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                                background: "none", border: "none", cursor: "pointer", color: "#8b90a0", fontSize: 14,
                            }}
                        >
                            <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"}`}></i>
                        </button>
                    </div>
                </div>
                <div className="admin-form-group">
                    <label className="admin-form-label">Confirm Password *</label>
                    <input
                        type={showPassword ? "text" : "password"}
                        className="admin-form-input"
                        autoComplete="new-password"
                        value={form.confirmPassword}
                        onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                        placeholder="Re-enter password"
                    />
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                    <button className="admin-btn admin-btn-ghost" onClick={onClose}>Cancel</button>
                    <button
                        className="admin-btn admin-btn-primary"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? "Saving..." : "Add Free Agent"}
                    </button>
                </div>
            </div>
        </div>
    );
}


export default function AdminFreeAgentsPage() {
    const { user, activeRole } = useAuth();
    const effectiveRole = activeRole || user?.role;
    const isAdmin = effectiveRole === "admin";
    const { showSuccess, showError } = useToast();

    const [freeAgents, setFreeAgents] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [assigning, setAssigning] = useState(null);
    const [jerseyPrompt, setJerseyPrompt] = useState(null);
    const [jerseyInput, setJerseyInput] = useState("");

    const canManage = user && hasAnyAccess(user, [
        "manage_players",
        "player_view",
        "player_create",
        "player_update",
        "player_delete",
    ]);
    const canCreate = user && hasAnyAccess(user, ["manage_players", "player_create"]);
    const canDelete = isAdmin && user && hasAnyAccess(user, ["manage_players", "player_delete"]);

    const fetchData = useCallback(async () => {
        if (!canManage) { setLoading(false); return; }
        try {
            const fetches = [fetch("/api/free-agents"), fetch("/api/teams")];
            if (isAdmin) fetches.push(fetch("/api/organizations"));

            const responses = await Promise.all(fetches);
            const [faData, teamsData, orgData] = await Promise.all(responses.map(r => r.json()));

            if (faData.success) setFreeAgents(faData.data || []);
            else showError(faData.error || "Failed to load free agents");

            if (teamsData.success) setTeams(teamsData.data || []);

            if (orgData?.success) setOrganizations(orgData.data || []);
        } catch {
            showError("Failed to load free agents");
        } finally {
            setLoading(false);
        }
    }, [canManage, isAdmin, showError]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filtered = freeAgents.filter((fa) => {
        const q = search.toLowerCase();
        return (
            fa.name?.toLowerCase().includes(q) ||
            (fa.email || fa.user?.email)?.toLowerCase().includes(q) ||
            fa.organization?.name?.toLowerCase().includes(q)
        );
    });

    const saveFreeAgent = async (payload) => {
        try {
            const res = await fetch("/api/free-agents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!data.success) {
                showError(data.error || "Failed to add free agent");
                return;
            }
            setModalOpen(false);
            fetchData();
            showSuccess("Free agent added!");
        } catch {
            showError("Failed to add free agent");
        }
    };

    const deleteFreeAgent = async (fa) => {
        if (!confirm(`Remove "${fa.name}" as a free agent?`)) return;
        try {
            const res = await fetch(`/api/free-agents/${fa._id}`, { method: "DELETE" });
            const data = await res.json();
            if (!data.success) {
                showError(data.error || "Failed to remove free agent");
                return;
            }
            fetchData();
            showSuccess("Free agent removed!");
        } catch {
            showError("Failed to remove free agent");
        }
    };

    const openAssignModal = (fa) => {
        setJerseyPrompt({ fa, selectedTeams: [] });
    };

    const confirmAssignToTeam = async () => {
        if (!jerseyPrompt) return;
        const { fa, selectedTeams } = jerseyPrompt;

        if (selectedTeams.length === 0) {
            showError("Please select at least one team");
            return;
        }

        // Validate all have jersey numbers
        for (const tReq of selectedTeams) {
            if (!tReq.jerseyNumber || isNaN(Number(tReq.jerseyNumber))) {
                showError(`Please enter a valid jersey number for ${tReq.teamName}`);
                return;
            }
            const team = teams.find(t => String(t._id) === tReq.teamId);
            if (team) {
                const existing = (team.players || []).find(p => p.jerseyNumber === Number(tReq.jerseyNumber));
                if (existing) {
                    showError(`Jersey #${tReq.jerseyNumber} is already taken on ${team.name}`);
                    return;
                }
            }
        }

        setAssigning(fa._id);
        try {
            const res = await fetch(`/api/players/${fa._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teams: selectedTeams }),
            });
            const data = await res.json();
            if (!data.success) {
                showError(data.error || "Failed to assign to team(s)");
                return;
            }
            fetchData();
            setJerseyPrompt(null);
            showSuccess(`${fa.name} assigned successfully!`);
        } catch {
            showError("Failed to assign to team(s)");
        } finally {
            setAssigning(null);
        }
    };

    return (
        <AdminLayout title="Free Agents">
            {!canManage ? (
                <div className="admin-empty">
                    <i className="fa-solid fa-lock"></i>
                    <p>You don&apos;t have permission to manage free agents.</p>
                </div>
            ) : (
                <>
                    <div className="admin-card">
                        <div className="admin-card-header" style={{ flexWrap: "wrap", gap: 10 }}>
                            <h3>Free Agents ({filtered.length})</h3>
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                <input
                                    type="text"
                                    className="admin-form-input"
                                    placeholder="Search..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    style={{ flex: "1 1 140px", minWidth: 120, maxWidth: 220 }}
                                />
                                {canCreate && (
                                    <button
                                        className="admin-btn admin-btn-ghost"
                                        onClick={() => setImportModalOpen(true)}
                                        style={{ flexShrink: 0 }}
                                    >
                                        <i className="fa-solid fa-file-csv"></i> Import CSV
                                    </button>
                                )}
                                {canCreate && (
                                    <button
                                        className="admin-btn admin-btn-primary"
                                        onClick={() => setModalOpen(true)}
                                        style={{ flexShrink: 0 }}
                                    >
                                        <i className="fa-solid fa-plus"></i> Add Free Agent
                                    </button>
                                )}
                            </div>
                        </div>

                        {loading ? (
                            <div className="admin-loading">
                                <div className="admin-spinner"></div>
                                Loading free agents...
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-user-clock"></i>
                                <p>No free agents found.</p>
                            </div>
                        ) : (
                            <>
                                {/* Desktop table */}
                                <div className="free-agents-table-wrap">
                                    <div style={{ overflowX: "auto" }}>
                                        <table className="admin-table">
                                            <thead>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Email</th>
                                                    {isAdmin && <th>Organization</th>}
                                                    <th>Phone</th>
                                                    <th>{isAdmin ? "Added" : "Assign to Team"}</th>
                                                    {isAdmin && <th style={{ width: 80 }}>Actions</th>}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filtered.map((fa) => (
                                                    <tr key={fa._id}>
                                                        <td style={{ fontWeight: 600 }}>{fa.name}</td>
                                                        <td style={{ color: "#6b7280" }}>{fa.email || fa.user?.email || "—"}</td>
                                                        {isAdmin && (
                                                            <td>{fa.organization?.name || "—"}</td>
                                                        )}
                                                        <td style={{ color: "#6b7280" }}>{fa.phone || fa.user?.phone || "—"}</td>
                                                        <td>
                                                            {isAdmin ? (
                                                                <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 13 }}>
                                                                    {fa.createdAt ? new Date(fa.createdAt).toLocaleDateString() : "—"}
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    className="admin-btn admin-btn-secondary admin-btn-sm"
                                                                    onClick={() => openAssignModal(fa)}
                                                                    disabled={assigning === fa._id}
                                                                >
                                                                    <i className="fa-solid fa-plus"></i> Add to Team
                                                                </button>
                                                            )}
                                                        </td>
                                                        {isAdmin && (
                                                            <td>
                                                                {canDelete && (
                                                                    <button
                                                                        className="admin-btn admin-btn-danger admin-btn-sm"
                                                                        onClick={() => deleteFreeAgent(fa)}
                                                                        title="Remove free agent"
                                                                    >
                                                                        <i className="fa-solid fa-trash"></i>
                                                                    </button>
                                                                )}
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Mobile cards */}
                                <div className="free-agents-card-list">
                                    {filtered.map((fa) => (
                                        <div key={fa._id} className="free-agents-card-item">
                                            <div className="free-agents-card-item-title">{fa.name}</div>
                                            <div className="free-agents-card-item-meta">
                                                {(fa.email || fa.user?.email) && <span>{fa.email || fa.user?.email}</span>}
                                                {(fa.phone || fa.user?.phone) && <span>{fa.phone || fa.user?.phone}</span>}
                                                {isAdmin && fa.organization?.name && (
                                                    <span><strong>Org:</strong> {fa.organization.name}</span>
                                                )}
                                                {isAdmin && fa.createdAt && (
                                                    <span>Added: {new Date(fa.createdAt).toLocaleDateString()}</span>
                                                )}
                                            </div>
                                            <div className="free-agents-card-item-actions">
                                                {!isAdmin && (
                                                    <button
                                                        className="admin-btn admin-btn-secondary admin-btn-sm"
                                                        onClick={() => openAssignModal(fa)}
                                                        disabled={assigning === fa._id}
                                                    >
                                                        <i className="fa-solid fa-plus"></i> Add to Team
                                                    </button>
                                                )}
                                                {isAdmin && canDelete && (
                                                    <button
                                                        className="admin-btn admin-btn-danger admin-btn-sm"
                                                        onClick={() => deleteFreeAgent(fa)}
                                                    >
                                                        <i className="fa-solid fa-trash"></i> Remove
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {modalOpen && (
                        <AddFreeAgentModal
                            onClose={() => setModalOpen(false)}
                            onSave={saveFreeAgent}
                            organizations={organizations}
                            isAdmin={isAdmin}
                        />
                    )}

                    {importModalOpen && (
                        <CsvImportModal
                            onClose={() => setImportModalOpen(false)}
                            onImportDone={() => fetchData()}
                        />
                    )}

                    {jerseyPrompt && (
                        <div className="admin-modal-backdrop">
                            <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
                                <button className="admin-modal-close" onClick={() => setJerseyPrompt(null)} aria-label="Close">
                                    <i className="fa-solid fa-xmark"></i>
                                </button>
                                <h3 className="admin-modal-title">Assign to Team</h3>
                                <p style={{ color: "#8b90a0", fontSize: 14, marginBottom: 16 }}>
                                    Assign <strong>{jerseyPrompt.fa.name}</strong> to a team.
                                </p>
                                <div className="admin-form-group">
                                    <label className="admin-form-label">Available Teams</label>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                                        {teams.filter(t => !t.isPlaceholder && !jerseyPrompt.selectedTeams.find(st => st.teamId === String(t._id))).map(t => (
                                            <div
                                                key={t._id}
                                                onClick={() => {
                                                    setJerseyPrompt(prev => ({
                                                        ...prev,
                                                        selectedTeams: [...prev.selectedTeams, { teamId: String(t._id), teamName: t.name, jerseyNumber: "" }]
                                                    }));
                                                }}
                                                style={{
                                                    padding: "6px 12px",
                                                    background: "#f0f1f5",
                                                    border: "1px solid #d5d8e0",
                                                    borderRadius: 16,
                                                    fontSize: 13,
                                                    cursor: "pointer",
                                                    color: "#1a1d26",
                                                    transition: "all 0.2s"
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = "#e5e7ef"; e.currentTarget.style.borderColor = "#c5c8d0"; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = "#f0f1f5"; e.currentTarget.style.borderColor = "#d5d8e0"; }}
                                            >
                                                + {t.name}
                                            </div>
                                        ))}
                                        {teams.filter(t => !t.isPlaceholder && !jerseyPrompt.selectedTeams.find(st => st.teamId === String(t._id))).length === 0 && (
                                            <div style={{ fontSize: 13, color: "#8b90a0", fontStyle: "italic" }}>No more teams available.</div>
                                        )}
                                    </div>
                                    
                                    <label className="admin-form-label">Team Pool (Selected)</label>
                                    <div style={{ background: "#f9fafb", border: "1px solid #e8eaef", borderRadius: 8, padding: 12 }}>
                                        {jerseyPrompt.selectedTeams.length === 0 ? (
                                            <div style={{ fontSize: 13, color: "#8b90a0", fontStyle: "italic", padding: "8px 0" }}>Click a team above to add it to the pool.</div>
                                        ) : (
                                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                                {jerseyPrompt.selectedTeams.map((st, index) => (
                                                    <div key={st.teamId} style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid #e5e7ef", borderRadius: 6, padding: "8px 12px", gap: 12 }}>
                                                        <div style={{ flex: 1, fontWeight: 600, fontSize: 14, color: "#1a1d26" }}>{st.teamName}</div>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                            <label style={{ fontSize: 12, color: "#5a5f72", fontWeight: 500 }}>Jersey #</label>
                                                            <input
                                                                type="number"
                                                                className="admin-form-input"
                                                                value={st.jerseyNumber}
                                                                onChange={(e) => {
                                                                    const newTeams = [...jerseyPrompt.selectedTeams];
                                                                    newTeams[index].jerseyNumber = e.target.value;
                                                                    setJerseyPrompt(prev => ({ ...prev, selectedTeams: newTeams }));
                                                                }}
                                                                placeholder="0-99"
                                                                min="0"
                                                                max="99"
                                                                style={{ width: 64, textAlign: "center", padding: "6px" }}
                                                            />
                                                            <button
                                                                type="button"
                                                                className="admin-btn admin-btn-ghost admin-btn-sm"
                                                                onClick={() => {
                                                                    setJerseyPrompt(prev => ({ ...prev, selectedTeams: prev.selectedTeams.filter((_, i) => i !== index) }));
                                                                }}
                                                                style={{ color: "#dc2626", marginLeft: 4 }}
                                                                title="Remove team"
                                                            >
                                                                <i className="fa-solid fa-xmark"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
                                    <button className="admin-btn admin-btn-ghost" onClick={() => setJerseyPrompt(null)}>Cancel</button>
                                    <button className="admin-btn admin-btn-primary" onClick={confirmAssignToTeam} disabled={jerseyPrompt.selectedTeams.length === 0 || jerseyPrompt.selectedTeams.some(t => !t.jerseyNumber)}>
                                        Assign
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </AdminLayout>
    );
}
