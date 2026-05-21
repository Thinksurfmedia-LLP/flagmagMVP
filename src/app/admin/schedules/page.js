"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminPagination from "@/components/AdminPagination";
import AdminLayout, { hasAnyAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/AdminToast";

import { useRouter } from "next/navigation";

export default function SchedulesPage() {
    const router = useRouter();
    const { user, activeRole } = useAuth();
    const { showSuccess, showError } = useToast();

    const [schedules, setSchedules] = useState([]);
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [entriesPerPage, setEntriesPerPage] = useState(10);
    const [sortCol, setSortCol] = useState(null);
    const [sortDir, setSortDir] = useState("asc");
    const [currentPage, setCurrentPage] = useState(1);

    // Geo filter state
    const [allVenues, setAllVenues] = useState([]);
    const [filterState, setFilterState] = useState("");
    const [filterCounty, setFilterCounty] = useState("");
    const [filterCity, setFilterCity] = useState("");
    const [filterLocation, setFilterLocation] = useState("");



    const effectiveRole = activeRole || user?.role;
    const isAdmin = effectiveRole === "admin";
    const canView = hasAnyAccess(user, ["manage_schedules", "schedule_view", "schedule_create", "schedule_update", "schedule_delete"]);
    const canCreate = hasAnyAccess(user, ["manage_schedules", "schedule_create"]);
    const canUpdate = hasAnyAccess(user, ["manage_schedules", "schedule_update"]);
    const canDelete = hasAnyAccess(user, ["manage_schedules", "schedule_delete"]);

    const organizerOrg = user?.roleOrganizations?.[effectiveRole] || user?.organization;
    const userOrgId = organizerOrg?.id || organizerOrg?._id || "";
    const userOrgName = organizerOrg?.name || "";

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

    // Fetch organizations (admin only)
    const needsOrgPicker = user?.role === "admin";
    useEffect(() => {
        if (!needsOrgPicker) return;
        fetch("/api/organizations")
            .then((r) => r.json())
            .then((d) => {
                if (d.success) setOrganizations(d.data);
            })
            .catch(() => {});
    }, [needsOrgPicker]);

    const fetchSchedules = useCallback(async () => {
        if (!canView) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const params = new URLSearchParams();
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
    }, [canView, search, showError]);

    useEffect(() => {
        fetchSchedules();
    }, [fetchSchedules]);

    // Fetch venues once for geo filter dropdowns
    useEffect(() => {
        fetch("/api/locations")
            .then((r) => r.json())
            .then((d) => { if (d.success) setAllVenues(d.data || []); })
            .catch(() => {});
    }, []);

    // Geo filter derived options
    const geoStateOptions = [...new Map(allVenues.filter(v => v.stateId).map(v => [v.stateId, { id: v.stateId, name: v.stateName }])).values()].sort((a, b) => a.name.localeCompare(b.name));
    const geoCountyOptions = filterState ? [...new Map(allVenues.filter(v => v.stateId === filterState).map(v => [v.countyId, { id: v.countyId, name: v.countyName }])).values()].sort((a, b) => a.name.localeCompare(b.name)) : [];
    const geoCityOptions = filterState ? [...new Set(allVenues.filter(v => (filterCounty ? v.countyId === filterCounty : v.stateId === filterState) && v.cityName).map(v => v.cityName))].sort() : [];
    const geoVenueOptions = filterCity
        ? allVenues.filter(v => v.cityName === filterCity && (filterCounty ? v.countyId === filterCounty : v.stateId === filterState)).sort((a, b) => a.name.localeCompare(b.name))
        : filterCounty ? allVenues.filter(v => v.countyId === filterCounty).sort((a, b) => a.name.localeCompare(b.name))
        : filterState ? allVenues.filter(v => v.stateId === filterState).sort((a, b) => a.name.localeCompare(b.name))
        : [];
    const handleGeoStateChange = (val) => { setFilterState(val); setFilterCounty(""); setFilterCity(""); setFilterLocation(""); };
    const handleGeoCountyChange = (val) => { setFilterCounty(val); setFilterCity(""); setFilterLocation(""); };

    const filteredSchedules = useMemo(() => {
        if (!filterState && !filterCounty && !filterCity && !filterLocation) return schedules;
        const lookup = Object.fromEntries(allVenues.map(v => [v.name, { stateId: v.stateId, countyId: v.countyId, cityName: v.cityName || "" }]));
        return schedules.filter(s => {
            const v = lookup[s.locationName];
            if (!v) return false;
            if (filterLocation) return s.locationName === filterLocation;
            if (filterCity) return v.cityName === filterCity;
            if (filterCounty) return v.countyId === filterCounty;
            if (filterState) return v.stateId === filterState;
            return true;
        });
    }, [schedules, allVenues, filterState, filterCounty, filterCity, filterLocation]);

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
    }, [search, sortCol, sortDir, entriesPerPage, filterState, filterCounty, filterCity, filterLocation]);

    const totalPages = Math.ceil(sortedSchedules.length / entriesPerPage);
    const paginatedSchedules = sortedSchedules.slice(
        (currentPage - 1) * entriesPerPage,
        currentPage * entriesPerPage
    );



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
        router.push("/admin/schedules/add");
    };

    const openEditModal = (schedule) => {
        router.push(`/admin/schedules/${schedule._id}`);
    };

    if (!canView) {
        return (
            <AdminLayout title="Schedules">
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
        <AdminLayout title="Schedules">
            <div className="admin-card">
                <div className="admin-card-header">
                    <h3>Schedules ({sortedSchedules.length})</h3>
                    {canCreate && (
                        <button className="admin-btn admin-btn-primary" onClick={openAddModal}>
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

                        {/* Geo Filter bar */}
                        <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, padding: "10px 16px 10px", borderBottom: "1px solid #e8eaf0", marginBottom: 4, alignItems: "center" }}>
                            <select className="admin-form-select" value={filterState} onChange={(e) => handleGeoStateChange(e.target.value)} style={{ width: 155, height: 34, fontSize: 13 }}>
                                <option value="">All States</option>
                                {geoStateOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            {filterState && (
                                <select className="admin-form-select" value={filterCounty} onChange={(e) => handleGeoCountyChange(e.target.value)} style={{ width: 155, height: 34, fontSize: 13 }}>
                                    <option value="">All Counties</option>
                                    {geoCountyOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            )}
                            {filterState && (
                                <select className="admin-form-select" value={filterCity} onChange={(e) => { setFilterCity(e.target.value); setFilterLocation(""); }} style={{ width: 155, height: 34, fontSize: 13 }}>
                                    <option value="">All Cities</option>
                                    {geoCityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            )}
                            {filterState && (
                                <select className="admin-form-select" value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} style={{ width: 175, height: 34, fontSize: 13 }}>
                                    <option value="">All Locations</option>
                                    {geoVenueOptions.map((v) => <option key={v._id} value={v.name}>{v.name}</option>)}
                                </select>
                            )}
                            {(filterState || filterCounty || filterCity || filterLocation) && (
                                <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={() => { setFilterState(""); setFilterCounty(""); setFilterCity(""); setFilterLocation(""); }} style={{ height: 34, whiteSpace: "nowrap" }}>
                                    <i className="fa-solid fa-xmark"></i> Clear
                                </button>
                            )}
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
                                                    style={{ cursor: "pointer", textTransform: "uppercase" }}
                                                >
                                                    League {sortIcon("scheduleLabel")}
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

        </AdminLayout>
    );
}
