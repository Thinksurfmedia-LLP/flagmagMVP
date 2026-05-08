"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "../lib/AuthContext";

export default function MobileHeader({ showSearch, showFilter, onSearch, onFilter }) {
    const { user, logout, refetch } = useAuth();
    const [navOpen, setNavOpen] = useState(false);
    const [uploadingProfile, setUploadingProfile] = useState(false);
    const fileInputRef = useRef(null);

    const handleProfileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadingProfile(true);
        try {
            const formData = new FormData();
            formData.append("file", file);

            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });
            const uploadData = await uploadRes.json();

            if (uploadData.success) {
                const updateRes = await fetch("/api/user/profile", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ profilePicture: uploadData.url }),
                });
                const updateData = await updateRes.json();
                if (updateData.success) {
                    if (refetch) await refetch();
                } else {
                    alert("Failed to update profile picture: " + updateData.error);
                }
            } else {
                alert("Upload failed: " + uploadData.error);
            }
        } catch (error) {
            console.error("Profile picture upload error:", error);
            alert("An error occurred during upload.");
        } finally {
            setUploadingProfile(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <header className="header" style={{ width: "100%" }}>
            <div className="header-row">
                <div>
                    <button className="hamburger-btn" onClick={() => setNavOpen(true)}>
                        <img src="/assets/images/menu-bar.png" alt="Menu" />
                    </button>
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
                {user && (
                    <div className="nav-user">
                        <div style={{ position: "relative", display: "inline-block" }}>
                            <div className="nav-user-avatar">
                                {user.profilePicture ? (
                                    <img src={user.profilePicture} alt="Profile" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                ) : (
                                    <img src="/assets/images/profile1.png" alt={user.name || "Profile"} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                                )}
                            </div>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploadingProfile}
                                style={{
                                    position: "absolute",
                                    top: -4,
                                    right: -4,
                                    background: "#f43f5e",
                                    color: "white",
                                    border: "none",
                                    borderRadius: "50%",
                                    width: 20,
                                    height: 20,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: uploadingProfile ? "not-allowed" : "pointer",
                                    fontSize: 10,
                                    boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                                    opacity: uploadingProfile ? 0.5 : 1,
                                    padding: 0
                                }}
                                title="Change Profile Picture"
                            >
                                {uploadingProfile ? (
                                    <span style={{ fontSize: 10 }}>...</span>
                                ) : (
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                                    </svg>
                                )}
                            </button>
                            <input
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                ref={fileInputRef}
                                onChange={handleProfileUpload}
                            />
                        </div>
                        <div className="nav-user-info">
                            <span className="nav-user-name">{user.name || "User"}</span>
                            <span className="nav-user-email">{user.email || ""}</span>
                        </div>
                    </div>
                )}
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
