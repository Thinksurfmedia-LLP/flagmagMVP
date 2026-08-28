"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";
import { useRouter } from "next/navigation";

// Mirrors Payment.status in src/models/Payment.js. "approved"/"cancelled"
// are declared on the schema but never actually set by the capture route —
// kept here only so an unexpected value still renders instead of falling
// through to the "created" look.
const STATUS_LABELS = {
    created: { label: "Pending", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    approved: { label: "Approved", color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
    captured: { label: "Paid", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
    failed: { label: "Failed", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
    cancelled: { label: "Cancelled", color: "#8b90a0", bg: "rgba(139,144,160,0.1)" },
};

const TYPE_LABELS = {
    "free-agent": "Free Agent",
    team: "Team",
    payment: "Custom Payment",
};

function StatusBadge({ status }) {
    const s = STATUS_LABELS[status] || STATUS_LABELS.created;
    return (
        <span style={{
            display: "inline-block",
            padding: "2px 10px",
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 600,
            background: s.bg,
            color: s.color,
        }}>
            {s.label}
        </span>
    );
}

function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function currency(amount) {
    return `$${Number(amount || 0).toFixed(2)}`;
}

// A registration's phone can come from the form itself (guest checkout) or,
// for a logged-in buyer, from their User record — the form doesn't always
// have one but the account does.
function phoneFor(reg) {
    return reg.phone || reg.user?.phone || "—";
}

export default function RegistrationsPage() {
    const { user, loading: authLoading } = useAuth();
    const { showError } = useToast();
    const router = useRouter();

    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterType, setFilterType] = useState("all");

    const isAdmin = user?.role === "admin" || user?.roles?.includes("admin");

    useEffect(() => {
        if (!authLoading && !isAdmin) router.replace("/admin");
    }, [authLoading, isAdmin, router]);

    const fetchRegistrations = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/payments");
            const data = await res.json();
            if (data.success) setRegistrations(data.data || []);
            else showError(data.error || "Failed to load registrations");
        } catch {
            showError("Failed to load registrations");
        } finally {
            setLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        if (isAdmin) fetchRegistrations();
    }, [isAdmin, fetchRegistrations]);

    const filtered = registrations.filter((r) => {
        const matchStatus = filterStatus === "all" || r.status === filterStatus;
        // Payment docs written before registrationType existed have no
        // value stored (Mongoose schema defaults don't backfill existing
        // documents) — treat missing as "payment", same fallback the Type
        // column already displays, so the filter agrees with what's shown.
        const matchType = filterType === "all" || (r.registrationType || "payment") === filterType;
        const s = search.toLowerCase();
        const matchSearch = !s || [r.name, r.email, r.phone, r.user?.phone, r.organizationName, r.leagueName, r.teamName]
            .some((v) => (v || "").toLowerCase().includes(s));
        return matchStatus && matchType && matchSearch;
    });

    if (authLoading || loading) {
        return (
            <AdminLayout title="Registrations">
                <div className="admin-loading"><div className="admin-spinner"></div>Loading registrations...</div>
            </AdminLayout>
        );
    }

    if (!isAdmin) return null;

    return (
        <AdminLayout title="Registrations">
            <div className="admin-card">
                <div className="admin-card-header">
                    <h3>
                        <i className="fa-solid fa-clipboard-list" style={{ marginRight: 7, color: "#FF1E00" }}></i>
                        Registrations ({filtered.length})
                    </h3>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <select
                            className="admin-form-select"
                            style={{ width: 150, height: 36, fontSize: 13 }}
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            <option value="all">All Types</option>
                            <option value="free-agent">Free Agent</option>
                            <option value="team">Team</option>
                            <option value="payment">Custom Payment</option>
                        </select>
                        <select
                            className="admin-form-select"
                            style={{ width: 140, height: 36, fontSize: 13 }}
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all">All Statuses</option>
                            <option value="created">Pending</option>
                            <option value="captured">Paid</option>
                            <option value="failed">Failed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <input
                            className="admin-form-input"
                            placeholder="Search name, email, phone, org, league..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ width: 260, height: 36, fontSize: 13 }}
                        />
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <div className="admin-empty">
                        <i className="fa-solid fa-clipboard-list"></i>
                        <p>{search || filterStatus !== "all" || filterType !== "all" ? "No matching registrations." : "No registrations yet."}</p>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Phone</th>
                                    <th>Organization</th>
                                    <th>League</th>
                                    <th>Type</th>
                                    <th>Team</th>
                                    <th>Amount</th>
                                    <th>Submitted</th>
                                    <th>Payment Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((reg) => (
                                    <tr key={reg._id}>
                                        <td style={{ fontWeight: 600 }}>{reg.name}</td>
                                        <td>{reg.email}</td>
                                        <td>{phoneFor(reg)}</td>
                                        <td>{reg.organizationName || <span style={{ color: "#a0a4b2" }}>—</span>}</td>
                                        <td>{reg.leagueName || <span style={{ color: "#a0a4b2" }}>—</span>}</td>
                                        <td>{TYPE_LABELS[reg.registrationType] || TYPE_LABELS.payment}</td>
                                        <td>{reg.teamName || <span style={{ color: "#a0a4b2" }}>—</span>}</td>
                                        <td>{currency(reg.capturedAmount ?? reg.amount)}</td>
                                        <td style={{ color: "#8b90a0", fontSize: 12 }}>{formatDate(reg.createdAt)}</td>
                                        <td><StatusBadge status={reg.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
