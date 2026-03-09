"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";
import "@/styles/admin.css";

const ALL_PERMISSIONS = [
    "manage_organizations",
    "manage_seasons",
    "manage_games",
    "manage_players",
    "manage_users",
    "view_dashboard",
];

function hasAccess(user, permission) {
    if (!user) return false;
    if (user.role === "admin") return true;
    return (user.permissions || []).includes(permission);
}

const NAV_ITEMS = [
    {
        section: "Overview",
        items: [
            { label: "Dashboard", href: "/admin", icon: "fa-solid fa-chart-pie", perm: "view_dashboard" },
        ],
    },
    {
        section: "Management",
        items: [
            { label: "Organizations", href: "/admin/organizations", icon: "fa-solid fa-building", perm: "manage_organizations" },
            { label: "Venues", href: "/admin/locations", icon: "fa-solid fa-map-location-dot", perm: "manage_organizations" },
            { label: "Players", href: "/admin/players", icon: "fa-solid fa-users", perm: "manage_players" },
            { label: "Games", href: "/admin/games", icon: "fa-solid fa-football", perm: "manage_games" },
        ],
    },
    {
        section: "Administration",
        items: [
            { label: "Users", href: "/admin/users", icon: "fa-solid fa-users-gear", perm: "manage_users" },
            { label: "Roles", href: "/admin/roles", icon: "fa-solid fa-shield-halved", perm: "manage_users" },
        ],
    },
];

function getImpersonationNav(orgSlug) {
    return [
        {
            section: "Organization",
            items: [
                { label: "Dashboard", href: `/admin/organizations/${orgSlug}`, icon: "fa-solid fa-chart-pie" },
                { label: "Seasons", href: `/admin/organizations/${orgSlug}/seasons`, icon: "fa-solid fa-calendar-days" },
                { label: "Games", href: `/admin/organizations/${orgSlug}/games`, icon: "fa-solid fa-football" },
                { label: "Players", href: `/admin/organizations/${orgSlug}/players`, icon: "fa-solid fa-users" },
                { label: "Teams", href: `/admin/organizations/${orgSlug}/teams`, icon: "fa-solid fa-people-group" },
            ],
        },
        {
            section: "Settings",
            items: [
                { label: "Organization", href: `/admin/organizations/${orgSlug}/settings`, icon: "fa-solid fa-gear" },
            ],
        },
    ];
}

export default function AdminLayout({ children, title }) {
    const { user, loading, logout } = useAuth();
    const { org: impersonatedOrg, exitImpersonation } = useImpersonation();
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    if (loading) {
        return (
            <div className="admin-wrapper" style={{ alignItems: "center", justifyContent: "center" }}>
                <div style={{ color: "#8b90a0", fontSize: 14 }}>Loading...</div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="admin-wrapper" style={{ alignItems: "center", justifyContent: "center" }}>
                <div style={{ textAlign: "center", color: "#5a5f72" }}>
                    <i className="fa-solid fa-lock" style={{ fontSize: 40, marginBottom: 16, display: "block" }}></i>
                    <p>Please log in to access the dashboard.</p>
                    <Link href="/login" className="admin-btn admin-btn-primary" style={{ marginTop: 12 }}>
                        Go to Login
                    </Link>
                </div>
            </div>
        );
    }

    const initials = (user.name || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    const isImpersonating = !!impersonatedOrg;
    const navSections = isImpersonating ? getImpersonationNav(impersonatedOrg.slug) : NAV_ITEMS;

    return (
        <div className="admin-wrapper">
            {/* Sidebar */}
            <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
                {isImpersonating ? (
                    <div className="admin-sidebar-brand" style={{ cursor: "default" }}>
                        {impersonatedOrg.logo ? (
                            <img src={impersonatedOrg.logo} alt={impersonatedOrg.name} />
                        ) : (
                            <div className="admin-org-initials">
                                {impersonatedOrg.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                            </div>
                        )}
                    </div>
                ) : (
                    <Link href="/admin" className="admin-sidebar-brand" onClick={() => setSidebarOpen(false)}>
                        <img src="/assets/images/logo.png" alt="FlagMag" />
                    </Link>
                )}

                <nav className="admin-sidebar-nav">
                    {navSections.map((section) => {
                        const visibleItems = isImpersonating
                            ? section.items
                            : section.items.filter(item => hasAccess(user, item.perm));
                        if (visibleItems.length === 0) return null;
                        return (
                            <div className="admin-nav-section" key={section.section}>
                                <div className="admin-nav-section-title">{section.section}</div>
                                {visibleItems.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`admin-nav-link ${pathname === item.href ? "active" : ""}`}
                                        onClick={() => setSidebarOpen(false)}
                                    >
                                        <i className={item.icon}></i>
                                        {item.label}
                                    </Link>
                                ))}
                            </div>
                        );
                    })}
                </nav>

                <div className="admin-sidebar-footer">
                    <div className="admin-user-card">
                        <div className="admin-user-avatar">{initials}</div>
                        <div className="admin-user-info">
                            <div className="admin-user-name">{user.name}</div>
                            <div className="admin-user-role">{user.role}</div>
                        </div>
                    </div>
                    <button
                        className="admin-nav-link"
                        style={{ marginTop: 8, color: "#dc2626" }}
                        onClick={async () => { await logout(); window.location.href = "/login"; }}
                    >
                        <i className="fa-solid fa-right-from-bracket"></i>
                        Logout
                    </button>
                    <Link
                        href="/"
                        className="admin-nav-link"
                        style={{ marginTop: 2 }}
                    >
                        <i className="fa-solid fa-arrow-left"></i>
                        Back to Site
                    </Link>
                </div>
            </aside>

            {/* Backdrop for mobile */}
            {sidebarOpen && (
                <div
                    style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 99 }}
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Main Content */}
            <main className="admin-main">
                {impersonatedOrg && (
                    <div className="admin-impersonation-banner">
                        <div className="admin-impersonation-inner">
                            <i className="fa-solid fa-user-secret"></i>
                            <span>Impersonation mode for <strong>{impersonatedOrg.name}</strong></span>
                            <button className="admin-impersonation-exit" onClick={() => { exitImpersonation(); window.location.href = "/admin/organizations"; }}>
                                <i className="fa-solid fa-xmark"></i> Exit
                            </button>
                        </div>
                    </div>
                )}
                <header className="admin-topbar">
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <button className="admin-mobile-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
                            <i className="fa-solid fa-bars"></i>
                        </button>
                        <h1>{title || "Dashboard"}</h1>
                    </div>
                </header>

                <div className="admin-content">
                    {children}
                </div>
            </main>
        </div>
    );
}

export { hasAccess, ALL_PERMISSIONS };
