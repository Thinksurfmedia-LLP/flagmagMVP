"use client";

import { useState, useEffect } from "react";
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

    // Multi-role redirect: send to role picker if no active role has been chosen
    useEffect(() => {
        if (loading || !user) return;
        const userRoles = user.roles?.length ? user.roles : [user.role];
        if (userRoles.length > 1 && !activeRole) {
            router.replace("/admin/select-role");
        } else if (userRoles.length === 1 && !activeRole) {
            setActiveRole(userRoles[0]);
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

    return (
        <AdminLayout title="Dashboard">
            {/* Stats */}
            <div className="admin-stats">
                <StatCard icon="fa-solid fa-users" color="blue" value={stats?.users ?? "—"} label="Total Users" />
                <StatCard icon="fa-solid fa-building" color="green" value={stats?.organizations ?? "—"} label="Organizations" />
                <StatCard icon="fa-solid fa-calendar" color="orange" value={stats?.seasons ?? "—"} label="Seasons" />
                <StatCard icon="fa-solid fa-football" color="purple" value={stats?.games ?? "—"} label="Games" />
            </div>

            {/* Quick Actions */}
            <div className="admin-card">
                <div className="admin-card-header">
                    <h3>Quick Actions</h3>
                </div>
                <div className="admin-card-body" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {hasAccess(user, "manage_organizations") && (
                        <QuickAction icon="fa-solid fa-plus" label="New Organization" href="/admin/organizations" />
                    )}
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
        </AdminLayout>
    );
}
