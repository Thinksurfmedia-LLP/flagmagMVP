"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AdminPagination from "@/components/AdminPagination";
import AdminLayout, { hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";
import { useToast } from "@/components/AdminToast";

function ScheduleModal({ open, editingSchedule, onClose, onSave, loading }) {
    const [scheduleLabel, setScheduleLabel] = useState("");
    const [locationName, setLocationName] = useState("");
    const [status, setStatus] = useState("Active");

    useEffect(() => {
        if (!open) return;
        if (editingSchedule) {
            setScheduleLabel(editingSchedule.scheduleLabel || "");
            setLocationName(editingSchedule.locationName || "");
            setStatus(editingSchedule.status || "Active");
        } else {
            setScheduleLabel("");
            setLocationName("");
            setStatus("Active");
        }
    }, [open, editingSchedule]);

    if (!open) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!scheduleLabel.trim() || !locationName.trim()) return;
        onSave({
            editingSchedule,
            scheduleLabel: scheduleLabel.trim(),
            locationName: locationName.trim(),
            status,
        });
    };

    return (
        <div className="admin-modal-backdrop" onClick={onClose}>
            <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
                <button className="admin-modal-close" onClick={onClose} aria-label="Close">
                    <i className="fa-solid fa-xmark"></i>
                </button>
                <h3 className="admin-modal-title">
                    {editingSchedule ? "Edit Schedule" : "Add Schedule"}
                </h3>

                <form onSubmit={handleSubmit}>
                    <div className="admin-form-group">
                        <label className="admin-form-label">Schedule Label *</label>
                        <input
                            type="text"
                            className="admin-form-input"
                            value={scheduleLabel}
                            onChange={(e) => setScheduleLabel(e.target.value)}
                            placeholder="Enter schedule label..."
                            required
                        />
                    </div>

                    <div className="admin-form-group">
                        <label className="admin-form-label">Location Name *</label>
                        <input
                            type="text"
                            className="admin-form-input"
                            value={locationName}
                            onChange={(e) => setLocationName(e.target.value)}
                            placeholder="Enter location name..."
                            required
                        />
                    </div>

                    <div className="admin-form-group">
                        <label className="admin-form-label">Status</label>
                        <select
                            className="admin-form-select"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>

                    <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
                        <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="admin-btn admin-btn-primary"
                            disabled={loading || !scheduleLabel.trim() || !locationName.trim()}
                        >
                            {loading ? "Saving..." : editingSchedule ? "Save Changes" : "Add Schedule"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function OrgSchedulesPage() {
    const { slug } = useParams();
    const { user } = useAuth();
    const { org: impersonatedOrg, enterImpersonation } = useImpersonation();
    const { showSuccess, showError } = useToast();

    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [sortCol, setSortCol] = useState(null);
    const [sortDir, setSortDir] = useState("asc");
    const [currentPage, setCurrentPage] = useState(1);

    const [showModal, setShowModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [saving, setSaving] = useState(false);

    const canView = hasAnyAccess(user, ["manage_schedules", "schedule_view", "schedule_create", "schedule_update", "schedule_delete"]);
    const canCreate = hasAnyAccess(user, ["manage_schedules", "schedule_create"]);
    const canUpdate = hasAnyAccess(user, ["manage_schedules", "schedule_update"]);
    const canDelete = hasAnyAccess(user, ["manage_schedules", "schedule_delete"]);

    useEffect(() => {
        if (!impersonatedOrg && slug) {
            fetch(`/api/organizations/${slug}`)
                .then((r) => r.json())
                .then((d) => {
                    if (d.success) enterImpersonation(d.data);
                })
                .catch(() => {});
        }
    }, [slug, impersonatedOrg, enterImpersonation]);

    const toggleSort = (col) => {
        if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortCol(col);
            setSortDir("asc");
        }
    };

    const sortIcon = (col) => {
        if (sortCol !== col)
            return <i className="fa-solid fa-sort" style={{ opacity: 0.3, marginLeft: 4 }}></i>;
        return sortDir === "asc" ? (
            <i className="fa-solid fa-sort-up" style={{ marginLeft: 4, color: "#FF1E00" }}></i>
        ) : (
            <i className="fa-solid fa-sort-down" style={{ marginLeft: 4, color: "#FF1E00" }}></i>
        );
    };

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 400);
        return () => clearTimeout(t);
    }, [searchInput]);

    const fetchSchedules = useCallback(async () => {
        if (!canView || !impersonatedOrg?._id) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("organization", impersonatedOrg._id);
            if (search) params.set("search", search);
            const res = await fetch(`/api/schedules?${params.toString()}`);
            const data = await res.json();
            if (data.success) setSchedules(data.data);
            else showError(data.error || "Failed to load schedules");
        } catch {
            showError("Failed to load schedules");
        } finally {
            setLoading(false);
        }
    }, [canView, impersonatedOrg, search, showError]);

    useEffect(() => {
        fetchSchedules();
    }, [fetchSchedules]);

    const filteredSchedules = useMemo(() => {
        return schedules;
    }, [schedules]);

    const sortedSchedules = useMemo(() => {
        if (!sortCol) return filteredSchedules;
        const sorted = [...filteredSchedules].sort((a, b) => {
            if (sortCol === "scheduleLabel") {
                return (a.scheduleLabel || "").localeCompare(b.scheduleLabel || "");
            }
            if (sortCol === "locationName") {
                return (a.locationName || "").localeCompare(b.locationName || "");
            }
            if (sortCol === "status") {
                return (a.status || "").localeCompare(b.status || "");
            }
            return 0;
        });
        return sortDir === "desc" ? sorted.reverse() : sorted;
    }, [filteredSchedules, sortCol, sortDir]);

    useEffect(() => {
        setCurrentPage(1);
    }, [search, sortCol, sortDir, entriesPerPage]);

    const totalPages = Math.ceil(sortedSchedules.length / entriesPerPage);
    const paginatedSchedules = sortedSchedules.slice(
        (currentPage - 1) * entriesPerPage,
        currentPage * entriesPerPage
    );

    const handleSave = async (data) => {
        if (!impersonatedOrg?._id) {
            showError("Organization not loaded. Please refresh the page.");
            return;
        }
        
        setSaving(true);
        try {
            const payload = {
                scheduleLabel: data.scheduleLabel,
                locationName: data.locationName,
                status: data.status,
            };

            if (!data.editingSchedule) {
                payload.organization = impersonatedOrg._id;
            }

            const url = data.editingSchedule
                ? `/api/schedules/${data.editingSchedule._id}`
                : "/api/schedules";
            const method = data.editingSchedule ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const result = await res.json();
            if (result.success) {
                showSuccess(
                    data.editingSchedule ? "Schedule updated successfully" : "Schedule created successfully"
                );
                setShowModal(false);
                setEditingSchedule(null);
                fetchSchedules();
            } else {
                showError(result.error || "Failed to save schedule");
            }
        } catch {
            showError("Failed to save schedule");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (schedule) => {
        if (!confirm(`Are you sure you want to delete "${schedule.scheduleLabel}"?`)) return;

        try {
            const res = await fetch(`/api/schedules/${schedule._id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
                showSuccess("Schedule deleted successfully");
                fetchSchedules();
            } else {
                showError(data.error || "Failed to delete schedule");
            }
        } catch {
            showError("Failed to delete schedule");
        }
    };

    const openAddModal = () => {
        if (!impersonatedOrg?._id) {
            showError("Organization not loaded. Please wait.");
            return;
        }
        setEditingSchedule(null);
        setShowModal(true);
    };

    const openEditModal = (schedule) => {
        setEditingSchedule(schedule);
        setShowModal(true);
    };

    const orgName = impersonatedOrg?.name || slug;

    if (!canView) {
        return (
            <AdminLayout title={`Schedules - ${orgName}`}>
                <div className="admin-card">
                    <div className="admin-empty">
                        <i className="fa-solid fa-lock"></i>
                        <p>You do not have permission to view schedules.</p>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout title={`Schedules - ${orgName}`}>
            <div className="admin-card">
                <div className="admin-card-header">
                    <h3>Schedules ({sortedSchedules.length})</h3>
                    {canCreate && (
                        <button 
                            className="admin-btn admin-btn-primary" 
                            onClick={openAddModal}
                            disabled={!impersonatedOrg?._id}
                        >
                            <i className="fa-solid fa-plus"></i> Add Schedule
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="admin-loading">
                        <div className="admin-spinner"></div>
                        Loading schedules...
                    </div>
                ) : (
                    <>
                        <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e5e7ef" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#5a5f72" }}>
                                Show
                                <select
                                    style={{ padding: "4px 8px", border: "1px solid #d5d8e0", borderRadius: 6, fontSize: 14 }}
                                    value={entriesPerPage}
                                    onChange={(e) => setEntriesPerPage(Number(e.target.value))}
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                                entries
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#5a5f72" }}>
                                Search:
                                <input
                                    type="text"
                                    style={{ padding: "6px 12px", border: "1px solid #d5d8e0", borderRadius: 6, fontSize: 14, width: 200 }}
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder="Search..."
                                />
                            </div>
                        </div>

                        {sortedSchedules.length === 0 ? (
                            <div className="admin-empty">
                                <i className="fa-solid fa-calendar-alt"></i>
                                <p>No schedules found. Add your first schedule.</p>
                            </div>
                        ) : (
                            <>
                                <div style={{ overflowX: "auto" }}>
                                    <table className="admin-table">
                                        <thead>
                                            <tr>
                                                <th
                                                    onClick={() => toggleSort("scheduleLabel")}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    Schedule Label {sortIcon("scheduleLabel")}
                                                </th>
                                                <th
                                                    onClick={() => toggleSort("locationName")}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    Location Name {sortIcon("locationName")}
                                                </th>
                                                <th
                                                    onClick={() => toggleSort("status")}
                                                    style={{ cursor: "pointer" }}
                                                >
                                                    Status {sortIcon("status")}
                                                </th>
                                                {(canUpdate || canDelete) && <th style={{ width: 120 }}>Actions</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedSchedules.map((schedule) => (
                                                <tr key={schedule._id}>
                                                    <td style={{ fontWeight: 600 }}>{schedule.scheduleLabel}</td>
                                                    <td>{schedule.locationName}</td>
                                                    <td>
                                                        <span
                                                            style={{
                                                                display: "inline-block",
                                                                padding: "4px 10px",
                                                                borderRadius: 6,
                                                                fontSize: 12,
                                                                fontWeight: 600,
                                                                background: schedule.status === "Active" ? "#d1fae5" : "#e5e7eb",
                                                                color: schedule.status === "Active" ? "#065f46" : "#6b7280",
                                                            }}
                                                        >
                                                            {schedule.status}
                                                        </span>
                                                    </td>
                                                    {(canUpdate || canDelete) && (
                                                        <td>
                                                            <div style={{ display: "flex", gap: 6 }}>
                                                                {canUpdate && (
                                                                    <button
                                                                        className="admin-btn admin-btn-ghost admin-btn-sm"
                                                                        onClick={() => openEditModal(schedule)}
                                                                        title="Edit"
                                                                    >
                                                                        <i className="fa-solid fa-pen"></i>
                                                                    </button>
                                                                )}
                                                                {canDelete && (
                                                                    <button
                                                                        className="admin-btn admin-btn-danger admin-btn-sm"
                                                                        onClick={() => handleDelete(schedule)}
                                                                        title="Delete"
                                                                    >
                                                                        <i className="fa-solid fa-trash"></i>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {totalPages > 1 && (
                                    <div style={{ padding: "16px 24px", borderTop: "1px solid #e5e7ef" }}>
                                        <AdminPagination
                                            currentPage={currentPage}
                                            totalPages={totalPages}
                                            onPageChange={setCurrentPage}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>

            <ScheduleModal
                open={showModal}
                editingSchedule={editingSchedule}
                onClose={() => {
                    setShowModal(false);
                    setEditingSchedule(null);
                }}
                onSave={handleSave}
                loading={saving}
            />
        </AdminLayout>
    );
}
