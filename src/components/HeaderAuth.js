"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

export default function HeaderAuth() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = async () => {
        setOpen(false);
        await logout();
        router.push("/");
        router.refresh();
    };

    if (loading) {
        return (
            <div className="header-btn-col">
                <span className="btn btn-info-primary" style={{ opacity: 0.5 }}>...</span>
            </div>
        );
    }

    if (user) {
        return (
            <div className="header-btn-col">
                <div ref={dropdownRef} style={{ position: "relative" }}>
                    <button
                        className="btn btn-info-primary"
                        onClick={() => setOpen((v) => !v)}
                        style={{ cursor: "pointer" }}
                    >
                        <i className="fa-solid fa-user me-1"></i> {user.name.split(" ")[0]}
                        <i className={`fa-solid fa-chevron-down ms-2`} style={{ fontSize: "10px", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}></i>
                    </button>
                    {open && (
                        <div style={{
                            position: "absolute",
                            top: "calc(100% + 8px)",
                            right: 0,
                            background: "#fff",
                            borderRadius: "10px",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                            minWidth: "160px",
                            zIndex: 9999,
                            overflow: "hidden",
                        }}>
                            <Link
                                href="/admin"
                                onClick={() => setOpen(false)}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "10px",
                                    padding: "12px 16px",
                                    color: "#23262f",
                                    fontWeight: 600,
                                    fontSize: "14px",
                                    textDecoration: "none",
                                    transition: "background 0.15s",
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                            >
                                <i className="fa-solid fa-gauge" style={{ color: "#FF1E00", width: "16px" }}></i>
                                Dashboard
                            </Link>
                        </div>
                    )}
                </div>
                <button onClick={handleLogout} className="btn btn-primary btn-with-arrow">
                    LOGOUT <span><img src="/assets/images/btn-arrow.png" alt="" /></span>
                </button>
            </div>
        );
    }

    return (
        <div className="header-btn-col">
            <Link href="/login" className="btn btn-info-primary">LOGIN</Link>
            <Link href="#" className="btn btn-primary btn-with-arrow">
                BOOK a Demo <span><img src="/assets/images/btn-arrow.png" alt="" /></span>
            </Link>
        </div>
    );
}
