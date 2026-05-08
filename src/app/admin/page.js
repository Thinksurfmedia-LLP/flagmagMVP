"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AdminLayout, { hasAccess } from "@/components/AdminLayout";
import { useAuth } from "@/components/AuthProvider";

function StatCard({ icon, color, value, label }) {
    return (
        <div className="admin-stat-card">
            <div className={`admin-stat-icon ${color}`}>
                <i className={icon}></i>
            </div>
            <div>
                <div className="admin-stat-value">{value}</div>
                <div className="admin-stat-label">{label}</div>
            </div>
        </div>
    );
}

function QuickAction({ icon, label, href }) {
    return (
        <Link href={href} className="admin-btn admin-btn-ghost" style={{ flex: 1, justifyContent: "center", padding: "14px 16px" }}>
            <i className={icon}></i>
            {label}
        </Link>
    );
}

export default function AdminDashboard() {
    const { user, loading, activeRole, setActiveRole } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState(null);
    const [recentUsers, setRecentUsers] = useState([]);
    const [activities, setActivities] = useState([]);

    const timeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);
        
        let interval = Math.floor(seconds / 31536000);
        if (interval >= 1) return interval + "y ago";
        interval = Math.floor(seconds / 2592000);
        if (interval >= 1) return interval + "mo ago";
        interval = Math.floor(seconds / 86400);
        if (interval >= 1) return interval + "d ago";
        interval = Math.floor(seconds / 3600);
        if (interval >= 1) return interval + "h ago";
        interval = Math.floor(seconds / 60);
        if (interval >= 1) return interval + "m ago";
        return Math.floor(seconds) + "s ago";
    };

    // Multi-role redirect: send to role picker if no active role has been chosen
    useEffect(() => {
        if (loading || !user) return;
        const userRoles = user.roles?.length ? user.roles : [user.role];
        const dashboardRoles = userRoles.filter(r => ["admin", "organizer"].includes(r));
        if (dashboardRoles.length > 1 && !activeRole) {
            router.replace("/admin/select-role");
        } else if (dashboardRoles.length === 1 && !activeRole) {
            setActiveRole(dashboardRoles[0]);
        } else if (dashboardRoles.length === 0) {
            router.replace("/");
        }
    }, [user, loading, activeRole, setActiveRole, router]);

    useEffect(() => {
        fetch("/api/admin/stats")
            .then(r => r.json())
            .then(d => { if (d.success) setStats(d.data); })
            .catch(() => {});

        if (user && hasAccess(user, "manage_users")) {
            fetch("/api/admin/users")
                .then(r => r.json())
                .then(d => { if (d.success) setRecentUsers(d.data.slice(0, 5)); })
                .catch(() => {});
        }
    }, [user]);

    const fetchActivities = useCallback(() => {
        if (!user) return;
        fetch("/api/admin/activities")
            .then(r => r.json())
            .then(d => { if (d.success) setActivities(d.data); })
            .catch(() => {});
    }, [user]);

    useEffect(() => {
        fetchActivities();
        const intervalId = setInterval(fetchActivities, 15000);
        return () => clearInterval(intervalId);
    }, [fetchActivities]);

    return (
        <AdminLayout title="Dashboard">
            {/* Stats */}
            <div className="admin-stats">
                <StatCard icon="fa-solid fa-users" color="blue" value={stats?.users ?? "—"} label="Total Users" />
                <StatCard icon="fa-solid fa-calendar" color="orange" value={stats?.seasons ?? "—"} label="Seasons" />
                <StatCard icon="fa-solid fa-trophy" color="yellow" value={stats?.leagues ?? "—"} label="Leagues" />
                <StatCard icon="fa-solid fa-football" color="purple" value={stats?.games ?? "—"} label="Games" />
            </div>

            {/* Quick Actions */}
            <div className="admin-card">
                <div className="admin-card-header">
                    <h3>Quick Actions</h3>
                </div>
                <div className="admin-card-body" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {hasAccess(user, "manage_games") && (
                        <QuickAction icon="fa-solid fa-gamepad" label="Manage Games" href="/admin/games" />
                    )}
                    {hasAccess(user, "manage_players") && (
                        <QuickAction icon="fa-solid fa-user-plus" label="Manage Players" href="/admin/players" />
                    )}
                    {hasAccess(user, "manage_users") && (
                        <QuickAction icon="fa-solid fa-user-shield" label="Manage Users" href="/admin/users" />
                    )}
                </div>
            </div>

            {/* Recent Users */}
            {hasAccess(user, "manage_users") && recentUsers.length > 0 && (
                <div className="admin-card">
                    <div className="admin-card-header">
                        <h3>Recent Users</h3>
                        <Link href="/admin/users" className="admin-btn admin-btn-ghost admin-btn-sm">
                            View All
                        </Link>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                        <table className="admin-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Joined</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentUsers.map(u => (
                                    <tr key={u._id}>
                                        <td>{u.name}</td>
                                        <td style={{ color: "rgba(255,255,255,0.5)" }}>{u.email}</td>
                                        <td><span className={`admin-badge ${u.role}`}>{u.role}</span></td>
                                        <td style={{ color: "rgba(255,255,255,0.4)" }}>
                                            {new Date(u.createdAt).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* System Activity Feed */}
            {hasAccess(user, "manage_users") && (
                <div className="admin-card" style={{ marginTop: 24 }}>
                    <div className="admin-card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3>System Activity</h3>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ fontSize: "0.85rem", color: "#6c757d" }}>
                                Updates every 15s
                            </span>
                            <button 
                                onClick={fetchActivities}
                                className="admin-btn admin-btn-ghost admin-btn-sm"
                                style={{ padding: "4px 8px", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6 }}
                            >
                                <i className="fa-solid fa-rotate-right"></i> Refresh
                            </button>
                        </div>
                    </div>
                    <div style={{ maxHeight: 400, overflowY: "auto", padding: "0 16px" }}>
                        {activities.length === 0 ? (
                            <div style={{ padding: "20px 0", textAlign: "center", color: "#6c757d" }}>
                                No recent activity.
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingBottom: 16 }}>
                                {activities.map(act => (
                                    <div key={act._id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px", background: "#f8f9fa", border: "1px solid #eee", borderRadius: 8 }}>
                                        <div style={{ 
                                            width: 40, height: 40, borderRadius: "50%", 
                                            background: "#e9ecef", 
                                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 
                                        }}>
                                            <i className="fa-solid fa-bolt" style={{ color: "#495057" }}></i>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                                <strong style={{ color: "#212529" }}>{act.user?.name || "System"}</strong>
                                                <span style={{ fontSize: "0.8rem", color: "#adb5bd" }}>{timeAgo(act.createdAt)}</span>
                                            </div>
                                            <div style={{ fontSize: "0.9rem", color: "#495057", marginBottom: 4 }}>
                                                {act.details}
                                            </div>
                                            <div style={{ display: "flex", gap: 8, fontSize: "0.75rem", flexWrap: "wrap" }}>
                                                <span style={{ padding: "2px 8px", background: "#e9ecef", borderRadius: 12, color: "#6c757d" }}>
                                                    {act.action}
                                                </span>
                                                <span style={{ padding: "2px 8px", background: "#e9ecef", borderRadius: 12, color: "#6c757d", textTransform: "capitalize" }}>
                                                    {act.role?.replace(/_/g, " ")}
                                                </span>
                                                {act.organization && (
                                                    <span style={{ padding: "2px 8px", background: "#e9ecef", borderRadius: 12, color: "#6c757d" }}>
                                                        {act.organization.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
