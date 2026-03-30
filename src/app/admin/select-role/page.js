"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const ROLE_CONFIG = {
    admin: {
        label: "Administrator",
        description: "Full platform access",
        icon: "fa-solid fa-shield-halved",
        color: "#FF1E00",
    },
    organizer: {
        label: "Organizer",
        description: "Manage your organization",
        icon: "fa-solid fa-building",
        color: "#efad02",
    },
    player: {
        label: "Player",
        description: "Your player profile",
        icon: "fa-solid fa-person-running",
        color: "#3b82f6",
    },
    viewer: {
        label: "Viewer",
        description: "Browse & watch",
        icon: "fa-solid fa-eye",
        color: "#8b5cf6",
    },
};

function getDefaultConfig(slug) {
    return {
        label: slug.charAt(0).toUpperCase() + slug.slice(1),
        description: "Access your dashboard",
        icon: "fa-solid fa-user",
        color: "#94a3b8",
    };
}

export default function SelectRolePage() {
    const router = useRouter();
    const { user, loading, setActiveRole } = useAuth();

    useEffect(() => {
        if (loading) return;
        if (!user) { router.replace("/login"); return; }
        const userRoles = user.roles?.length ? user.roles : [user.role];
        const dashboardRoles = userRoles.filter(r => ["admin", "organizer"].includes(r));
        if (dashboardRoles.length === 0) {
            router.replace("/");
        } else if (dashboardRoles.length === 1) {
            setActiveRole(dashboardRoles[0]);
            router.replace("/admin");
        }
    }, [user, loading, router, setActiveRole]);

    if (loading || !user) return null;

    const userRoles = user.roles?.length ? user.roles : [user.role];
    const dashboardRoles = userRoles.filter(role => ["admin", "organizer"].includes(role));

    if (dashboardRoles.length <= 1) return null;

    const handleSelect = (role) => {
        setActiveRole(role);
        router.push("/admin");
    };

    return (
        <div style={{
            minHeight: "100vh",
            background: "linear-gradient(180deg, #351D1B 0%, #0B0D13 100%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "40px 24px",
            fontFamily: "'DM Sans', sans-serif",
        }}>
            {/* Logo */}
            <img
                src="/assets/images/logo.png"
                alt="FlagMag"
                style={{ height: 48, marginBottom: 32, objectFit: "contain" }}
            />

            <div style={{ textAlign: "center", marginBottom: 40 }}>
                <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 600, margin: "0 0 8px", fontFamily: "'DM Sans', sans-serif" }}>
                    Welcome back, {user.name.split(" ")[0]}
                </h1>
                <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 16, margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
                    Choose a dashboard to continue
                </p>
            </div>

            <div style={{
                display: "flex",
                gap: 24,
                flexWrap: "wrap",
                justifyContent: "center",
                maxWidth: 700,
            }}>
                {dashboardRoles.map((slug) => {
                    const cfg = ROLE_CONFIG[slug] || getDefaultConfig(slug);
                    return (
                        <button
                            key={slug}
                            onClick={() => handleSelect(slug)}
                            style={{
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 16,
                                padding: "36px 44px",
                                cursor: "pointer",
                                textAlign: "center",
                                transition: "all 0.2s ease",
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 16,
                                minWidth: 220,
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.borderColor = cfg.color;
                                e.currentTarget.style.background = "rgba(255,255,255,0.08)";
                                e.currentTarget.style.transform = "translateY(-3px)";
                                e.currentTarget.style.boxShadow = `0 8px 32px ${cfg.color}25`;
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "none";
                            }}
                        >
                            <div style={{
                                width: 60, height: 60, borderRadius: 14,
                                background: `${cfg.color}18`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                                <i className={cfg.icon} style={{ fontSize: 26, color: cfg.color }}></i>
                            </div>
                            <div>
                                <div style={{ color: "#fff", fontSize: 20, fontWeight: 600, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>
                                    {cfg.label}
                                </div>
                                <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontFamily: "'DM Sans', sans-serif" }}>
                                    {cfg.description}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, marginTop: 48, fontFamily: "'DM Sans', sans-serif" }}>
                You can switch roles anytime from the sidebar
            </p>
        </div>
    );
}
