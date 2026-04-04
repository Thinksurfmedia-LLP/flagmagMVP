"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "../lib/AuthContext";

export default function MobileHeader({ showSearch, showFilter, onSearch, onFilter }) {
    const { user, logout } = useAuth();
    const [navOpen, setNavOpen] = useState(false);

    return (
        <header className="header" style={{ width: "100%" }}>
            <div className="header-row">
                <div>
                    <button className="hamburger-btn" onClick={() => setNavOpen(true)}>
                        <img src="/assets/images/menu-bar.png" alt="Menu" />
                    </button>
                </div>
                <div className="profile-area">
                    <div className="profile-image">
                        <img src="/assets/images/profile1.png" alt={user?.name || "Profile"} />
                    </div>
                </div>
            </div>

            {/* Nav overlay */}
            <div className={`nav-overlay ${navOpen ? "active" : ""}`} onClick={() => setNavOpen(false)} />
            <nav className={`nav-menu ${navOpen ? "active" : ""}`}>
                <div className="nav-close">
                    <button onClick={() => setNavOpen(false)}>
                        <img src="/assets/images/close.png" alt="Close" style={{ width: 18 }} />
                    </button>
                </div>
                <ul>
                    <li>
                        <Link href="/matches" onClick={() => setNavOpen(false)}>
                            Home
                        </Link>
                    </li>
                    <li>
                        <Link href="/matches" onClick={() => setNavOpen(false)}>
                            Games
                        </Link>
                    </li>
                    <li>
                        <Link href="/matches/create" onClick={() => setNavOpen(false)}>
                            Create Game
                        </Link>
                    </li>
                    {user && (
                        <li>
                            <button
                                onClick={() => {
                                    logout();
                                    setNavOpen(false);
                                }}
                                style={{
                                    color: "#ff1e00",
                                    padding: "15px",
                                    display: "block",
                                    width: "100%",
                                    textAlign: "left",
                                    fontSize: "15px",
                                }}
                            >
                                Logout
                            </button>
                        </li>
                    )}
                </ul>
            </nav>
        </header>
    );
}
