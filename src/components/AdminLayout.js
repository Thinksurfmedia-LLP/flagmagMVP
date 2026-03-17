"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useImpersonation } from "@/components/ImpersonationProvider";
import "@/styles/admin.css";

const ALL_PERMISSIONS = [
    "manage_organizations",
    "organization_view",
    "organization_create",
    "organization_update",
    "organization_delete",
    "manage_seasons",
    "season_view",
    "season_create",
    "season_update",
    "season_delete",
    "manage_games",
    "game_view",
    "game_create",
    "game_update",
    "game_delete",
    "manage_players",
    "player_view",
    "player_create",
    "player_update",
    "player_delete",
    "manage_teams",
    "team_view",
    "team_create",
    "team_update",
    "team_delete",
    "manage_users",
    "user_view",
    "user_create",
    "user_update",
    "user_delete",
];

const PERMISSION_COMPATIBILITY = {
    manage_organizations: ["organization_view", "organization_create", "organization_update", "organization_delete"],
    manage_seasons: ["season_view", "season_create", "season_update", "season_delete"],
    manage_games: ["game_view", "game_create", "game_update", "game_delete"],
    manage_players: ["player_view", "player_create", "player_update", "player_delete"],
    manage_teams: ["team_view", "team_create", "team_update", "team_delete"],
    manage_users: ["user_view", "user_create", "user_update", "user_delete"],
};

function hasAccess(user, permission) {
    if (!user) return false;
    if (user.role === "admin") return true;
    if (permission === "view_dashboard") return true;

    const perms = user.permissions || [];
    if (perms.includes(permission)) return true;

    const compatiblePerms = PERMISSION_COMPATIBILITY[permission] || [];
    return compatiblePerms.some((perm) => perms.includes(perm));
}

function hasAnyAccess(user, permissions = []) {
    return permissions.some((permission) => hasAccess(user, permission));
}

const NAV_ITEMS = [
    {
        section: "Overview",
        items: [
            { label: "Dashboard", href: "/admin", icon: "fa-solid fa-chart-pie", perm: "view_dashboard" },
        ],
    },
    {
        section: "League Management",
        items: [
            { label: "Organizations", href: "/admin/organizations", icon: "fa-solid fa-building", perm: "manage_organizations" },
            { label: "Seasons", href: "/admin/seasons", icon: "fa-solid fa-calendar-days", perm: "manage_seasons" },
            // { label: "Teams", href: "/admin/teams", icon: "fa-solid fa-people-group", perm: "manage_teams" },
            // { label: "Players", href: "/admin/players", icon: "fa-solid fa-users", perm: "manage_players" },
            // { label: "Games", href: "/admin/games", icon: "fa-solid fa-football", perm: "manage_games" },
        ],
    },
    {
        section: "Tournament Management",
        items: [
            // { label: "Organizations", href: "/admin/organizations", icon: "fa-solid fa-building", perm: "manage_organizations" },
            
            { label: "League", href: "/admin/league", icon: "fa-solid fa-calendar-days", perm: "manage_league" },
            { label: "Teams", href: "/admin/teams", icon: "fa-solid fa-people-group", perm: "manage_teams" },
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
                { label: "Dashboard", href: `/admin/organizations/${orgSlug}`, icon: "fa-solid fa-chart-pie", perm: "view_dashboard" },
                { label: "Seasons", href: `/admin/organizations/${orgSlug}/seasons`, icon: "fa-solid fa-calendar-days", perm: "manage_seasons" },
                { label: "Games", href: `/admin/organizations/${orgSlug}/games`, icon: "fa-solid fa-football", perm: "manage_games" },
                { label: "Players", href: `/admin/organizations/${orgSlug}/players`, icon: "fa-solid fa-users", perm: "manage_players" },
                { label: "Teams", href: `/admin/organizations/${orgSlug}/teams`, icon: "fa-solid fa-people-group", perm: "manage_teams" },
                { label: "Locations", href: `/admin/organizations/${orgSlug}/locations`, icon: "fa-solid fa-map-location-dot", perm: "manage_organizations" },
            ],
        },
        {
            section: "Administration",
            items: [
                { label: "Users", href: `/admin/organizations/${orgSlug}/users`, icon: "fa-solid fa-users-gear", perm: "manage_users" },
            ],
        },
        {
            section: "Settings",
            items: [
                { label: "Organization", href: `/admin/organizations/${orgSlug}/settings`, icon: "fa-solid fa-gear", perm: "manage_organizations" },
            ],
        },
    ];
}

function getOrganizerNav(orgSlug) {
    const nav = [
        {
            section: "Overview",
            items: [
                { label: "Dashboard", href: "/admin", icon: "fa-solid fa-chart-pie", perm: "view_dashboard" },
            ],
        },
        {
            section: "Management",
            items: [
                {
                    label: "Organizations",
                    href: "/admin/organizations",
                    icon: "fa-solid fa-building",
                    perms: ["manage_organizations", "organization_view", "organization_create", "organization_update", "organization_delete"],
                },
                {
                    label: "Seasons",
                    href: "/admin/seasons",
                    icon: "fa-solid fa-calendar-days",
                    perms: ["manage_seasons", "season_view", "season_create", "season_update", "season_delete"],
                },
                {
                    label: "Games",
                    href: "/admin/games",
                    icon: "fa-solid fa-football",
                    perms: ["manage_games", "game_view", "game_create", "game_update", "game_delete"],
                },
                {
                    label: "Teams",
                    href: "/admin/teams",
                    icon: "fa-solid fa-people-group",
                    perms: ["manage_teams", "team_view", "team_create", "team_update", "team_delete"],
                },
                {
                    label: "Players",
                    href: "/admin/players",
                    icon: "fa-solid fa-users",
                    perms: ["manage_players", "player_view", "player_create", "player_update", "player_delete"],
                },
                {
                    label: "Users",
                    href: "/admin/users",
                    icon: "fa-solid fa-users-gear",
                    perms: ["manage_users", "user_view", "user_create", "user_update", "user_delete"],
                },
            ],
        },
    ];
    if (orgSlug) {
        nav.push({
            section: "Settings",
            items: [
                { label: "Locations", href: `/admin/organizations/${orgSlug}/locations`, icon: "fa-solid fa-map-location-dot", perm: "view_dashboard" },
                { label: "Organization", href: `/admin/organizations/${orgSlug}/settings`, icon: "fa-solid fa-gear", perm: "view_dashboard" },
            ],
        });
    }
    return nav;
}

export default function AdminLayout({ children, title }) {
    const { user, loading, logout, activeRole, clearActiveRole } = useAuth();
    const { org: impersonatedOrg, exitImpersonation } = useImpersonation();
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const router = useRouter();
    const [fetchedOrgSlug, setFetchedOrgSlug] = useState(null);

    // If organizer has no user.organization, fetch their first org from the API
    const effectiveRole = activeRole || user?.role;
    useEffect(() => {
        if (effectiveRole === "organizer" && !user?.organization?.slug) {
            fetch("/api/organizations")
                .then(r => r.json())
                .then(data => {
                    if (data.success && data.data?.length > 0) {
                        setFetchedOrgSlug(data.data[0].slug);
                    }
                })
                .catch(() => {});
        }
    }, [effectiveRole, user?.organization?.slug]);

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
    const isOrganizer = effectiveRole === "organizer";
    const userRoles = user.roles?.length ? user.roles : [user.role];
    const isMultiRole = userRoles.length > 1;
    const organizerOrg = user.organization;
    const orgSlug = organizerOrg?.slug || fetchedOrgSlug;
    const navSections = isImpersonating
        ? getImpersonationNav(impersonatedOrg.slug)
        : isOrganizer
            ? getOrganizerNav(orgSlug)
            : NAV_ITEMS;

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
                ) : isOrganizer ? (
                    <Link href="/admin" className="admin-sidebar-brand" onClick={() => setSidebarOpen(false)}>
                        {organizerOrg?.logo ? (
                            <img src={organizerOrg.logo} alt={organizerOrg?.name || "Organization"} />
                        ) : organizerOrg?.name ? (
                            <div className="admin-org-initials">
                                {organizerOrg.name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                            </div>
                        ) : (
                            <img src="/assets/images/logo.png" alt="FlagMag" />
                        )}
                    </Link>
                ) : (
                    <Link href="/admin" className="admin-sidebar-brand" onClick={() => setSidebarOpen(false)}>
                        <img src="/assets/images/logo.png" alt="FlagMag" />
                    </Link>
                )}

                <nav className="admin-sidebar-nav">
                    {navSections.map((section) => {
                        const visibleItems = section.items.filter((item) => {
                            if (item.perms) return hasAnyAccess(user, item.perms);
                            return hasAccess(user, item.perm);
                        });
                        if (visibleItems.length === 0) return null;
                        return (
                            <div className="admin-nav-section" key={section.section}>
                                <div className="admin-nav-section-title">{section.section}</div>
                                {visibleItems.map((item) => {
                                    const targetPath = item.href.split("?")[0];
                                    const isActive = pathname === targetPath;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            className={`admin-nav-link ${isActive ? "active" : ""}`}
                                            onClick={() => setSidebarOpen(false)}
                                        >
                                            <i className={item.icon}></i>
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        );
                    })}
                </nav>

                <div className="admin-sidebar-footer">
                    <div className="admin-user-card">
                        <div className="admin-user-avatar">{initials}</div>
                        <div className="admin-user-info">
                            <div className="admin-user-name">{user.name}</div>
                            <div className="admin-user-role">{effectiveRole}</div>
                        </div>
                    </div>
                    {isMultiRole && (
                        <button
                            className="admin-nav-link"
                            style={{ marginTop: 8, color: "#a78bfa" }}
                            onClick={() => { clearActiveRole(); router.push("/admin/select-role"); }}
                        >
                            <i className="fa-solid fa-shuffle"></i>
                            Switch Role
                        </button>
                    )}
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

export { hasAccess, hasAnyAccess, ALL_PERMISSIONS };
