"use client";

import { useCallback, useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";
import { useRouter } from "next/navigation";

const STATUS_LABELS = {
    new: { label: "New", color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
    contacted: { label: "Contacted", color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
    scheduled: { label: "Scheduled", color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
    closed: { label: "Closed", color: "#8b90a0", bg: "rgba(139,144,160,0.1)" },
};

function StatusBadge({ status }) {
    const s = STATUS_LABELS[status] || STATUS_LABELS.new;
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

export default function EnquiriesPage() {
    const { user, loading: authLoading } = useAuth();
    const { showSuccess, showError } = useToast();
    const router = useRouter();

    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");

    const isAdmin = user?.role === "admin" || user?.roles?.includes("admin");

    useEffect(() => {
        if (!authLoading && !isAdmin) router.replace("/admin");
    }, [authLoading, isAdmin, router]);

    const fetchRequests = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/demo-requests");
            const data = await res.json();
            if (data.success) setRequests(data.data || []);
        } catch {
            showError("Failed to load enquiries");
        } finally {
            setLoading(false);
        }
    }, [showError]);

    useEffect(() => {
        if (isAdmin) fetchRequests();
    }, [isAdmin, fetchRequests]);

    const handleStatusChange = async (id, status) => {
        try {
            const res = await fetch(`/api/demo-requests/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            const data = await res.json();
            if (data.success) {
                setRequests((prev) => prev.map((r) => r._id === id ? { ...r, status } : r));
                showSuccess("Status updated");
            } else {
                showError(data.error || "Update failed");
            }
        } catch {
            showError("Update failed");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this enquiry?")) return;
        try {
            const res = await fetch(`/api/demo-requests/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                setRequests((prev) => prev.filter((r) => r._id !== id));
                showSuccess("Enquiry deleted");
            } else {
                showError(data.error || "Delete failed");
            }
        } catch {
            showError("Delete failed");
        }
    };

    const filtered = requests.filter((r) => {
        const matchStatus = filterStatus === "all" || r.status === filterStatus;
        const s = search.toLowerCase();
        const matchSearch = !s || [r.fullName, r.workEmail, r.organizationName, r.phone]
            .some((v) => (v || "").toLowerCase().includes(s));
        return matchStatus && matchSearch;
    });

    if (authLoading || loading) {
        return (
            <AdminLayout title="Enquiries">
                <div className="admin-loading"><div className="admin-spinner"></div>Loading enquiries...</div>
            </AdminLayout>
        );
    }

    if (!isAdmin) return null;

    return (
        <AdminLayout title="Enquiries">
            <div className="admin-card">
                <div className="admin-card-header">
                    <h3>
                        <i className="fa-solid fa-envelope-open-text" style={{ marginRight: 7, color: "#FF1E00" }}></i>
                        Demo Requests ({filtered.length})
                    </h3>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <select
                            className="admin-form-select"
                            style={{ width: 140, height: 36, fontSize: 13 }}
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="all">All Statuses</option>
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="closed">Closed</option>
                        </select>
                        <input
                            className="admin-form-input"
                            placeholder="Search name, email, org..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            style={{ width: 220, height: 36, fontSize: 13 }}
                        />
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <div className="admin-empty">
                        <i className="fa-solid fa-inbox"></i>
                        <p>{search || filterStatus !== "all" ? "No matching enquiries." : "No demo requests yet."}</p>
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Work Email</th>
                                    <th>Organization</th>
                                    <th>Phone</th>
                                    <th>Preferred Time</th>
                                    <th>Submitted</th>
                                    <th>Status</th>
                                    <th style={{ width: 110 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((req) => (
                                    <tr key={req._id}>
                                            <td style={{ fontWeight: 600 }}>{req.fullName}</td>
                                            <td>{req.workEmail}</td>
                                            <td>{req.organizationName}</td>
                                            <td>{req.phone}</td>
                                            <td>{req.preferredDateTime ? formatDate(req.preferredDateTime) : <span style={{ color: "#a0a4b2" }}>Not specified</span>}</td>
                                            <td style={{ color: "#8b90a0", fontSize: 12 }}>{formatDate(req.createdAt)}</td>
                                            <td><StatusBadge status={req.status} /></td>
                                            <td>
                                                <div style={{ display: "flex", gap: 6 }}>
                                                    <select
                                                        className="admin-form-select"
                                                        style={{ fontSize: 11, padding: "3px 6px", height: "auto", width: "auto" }}
                                                        value={req.status}
                                                        onChange={(e) => handleStatusChange(req._id, e.target.value)}
                                                    >
                                                        <option value="new">New</option>
                                                        <option value="contacted">Contacted</option>
                                                        <option value="scheduled">Scheduled</option>
                                                        <option value="closed">Closed</option>
                                                    </select>
                                                    <button
                                                        className="admin-btn admin-btn-danger admin-btn-sm"
                                                        title="Delete"
                                                        onClick={() => handleDelete(req._id)}
                                                    >
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
        </AdminLayout>
    );
}
