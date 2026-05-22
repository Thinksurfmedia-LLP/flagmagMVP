"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const inputStyle = {
    width: "100%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "8px",
    color: "#fff",
    padding: "10px 14px",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: "14px",
};

const labelStyle = {
    display: "block",
    color: "rgba(255,255,255,0.55)",
    fontSize: "12px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.6px",
    marginBottom: "6px",
};

const sectionTitleStyle = {
    color: "rgba(255,255,255,0.35)",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "1px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    paddingBottom: "8px",
    marginBottom: "16px",
    marginTop: "8px",
};

export default function PlayerEditModal({ onClose }) {
    const router = useRouter();
    const [form, setForm] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        fetch("/api/players/me")
            .then((r) => r.json())
            .then((data) => {
                if (data.success) {
                    const p = data.data;
                    setForm({
                        name: p.name || "",
                        photo: p.photo || "",
                        bannerImage: p.bannerImage || "",
                        about: p.about || "",
                        location: p.location || "",
                        socialLinks: {
                            facebook: p.socialLinks?.facebook || "",
                            instagram: p.socialLinks?.instagram || "",
                            youtube: p.socialLinks?.youtube || "",
                        },
                    });
                } else {
                    setError("Failed to load profile data.");
                }
                setLoading(false);
            })
            .catch(() => {
                setError("Failed to load profile data.");
                setLoading(false);
            });
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith("social_")) {
            const key = name.replace("social_", "");
            setForm((f) => ({ ...f, socialLinks: { ...f.socialLinks, [key]: value } }));
        } else {
            setForm((f) => ({ ...f, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            const res = await fetch("/api/players/me", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (data.success) {
                setSuccess("Profile updated successfully!");
                router.refresh();
                setTimeout(() => onClose(), 1500);
            } else {
                setError(data.error || "Update failed.");
            }
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    return (
        /* Backdrop — no onClick so clicking outside does NOT close the modal */
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.78)",
                zIndex: 10000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
            }}
        >
            {/* Modal panel — stopPropagation keeps accidental bubbling from closing */}
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    background: "#141414",
                    border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: "16px",
                    width: "100%",
                    maxWidth: "520px",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    padding: "28px 32px 32px",
                    position: "relative",
                    boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
                }}
            >
                {/* Header row */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "24px",
                    }}
                >
                    <h3 style={{ color: "#fff", margin: 0, fontWeight: 700, fontSize: "20px" }}>
                        Edit Profile
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            background: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.12)",
                            borderRadius: "50%",
                            width: "36px",
                            height: "36px",
                            cursor: "pointer",
                            color: "rgba(255,255,255,0.7)",
                            fontSize: "20px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            lineHeight: 1,
                            flexShrink: 0,
                            transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                    >
                        ×
                    </button>
                </div>

                {loading ? (
                    <p style={{ color: "rgba(255,255,255,0.4)", textAlign: "center", padding: "24px 0" }}>
                        Loading…
                    </p>
                ) : form ? (
                    <form onSubmit={handleSubmit}>
                        {error && (
                            <div className="alert alert-danger py-2" style={{ marginBottom: "16px" }}>
                                {error}
                            </div>
                        )}
                        {success && (
                            <div className="alert alert-success py-2" style={{ marginBottom: "16px" }}>
                                {success}
                            </div>
                        )}

                        {/* Basic Info */}
                        <p style={sectionTitleStyle}>Basic Info</p>

                        <label style={labelStyle}>Display Name</label>
                        <input
                            type="text"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            placeholder="Your name"
                            style={inputStyle}
                            required
                        />

                        <label style={labelStyle}>Location</label>
                        <input
                            type="text"
                            name="location"
                            value={form.location}
                            onChange={handleChange}
                            placeholder="City, State"
                            style={inputStyle}
                        />

                        <label style={labelStyle}>About</label>
                        <textarea
                            name="about"
                            value={form.about}
                            onChange={handleChange}
                            placeholder="Tell people about yourself…"
                            rows={3}
                            style={{ ...inputStyle, resize: "vertical", marginBottom: "14px" }}
                        />

                        <p style={{ ...sectionTitleStyle, marginTop: "4px", display: "flex", alignItems: "center", gap: 6 }}>
                            Locations
                            <span style={{ fontStyle: "italic", fontSize: "10px", textTransform: "none", letterSpacing: 0, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>
                                auto-populated from your leagues &amp; teams
                            </span>
                        </p>

                        {/* Images */}
                        <p style={{ ...sectionTitleStyle, marginTop: "20px" }}>Images</p>

                        <label style={labelStyle}>Profile Photo URL</label>
                        <input
                            type="url"
                            name="photo"
                            value={form.photo}
                            onChange={handleChange}
                            placeholder="https://…"
                            style={inputStyle}
                        />

                        <label style={labelStyle}>Banner Image URL</label>
                        <input
                            type="url"
                            name="bannerImage"
                            value={form.bannerImage}
                            onChange={handleChange}
                            placeholder="https://…"
                            style={inputStyle}
                        />

                        {/* Social Links */}
                        <p style={{ ...sectionTitleStyle, marginTop: "20px" }}>Social Links</p>

                        <label style={labelStyle}>Facebook</label>
                        <input
                            type="url"
                            name="social_facebook"
                            value={form.socialLinks.facebook}
                            onChange={handleChange}
                            placeholder="https://facebook.com/…"
                            style={inputStyle}
                        />

                        <label style={labelStyle}>Instagram</label>
                        <input
                            type="url"
                            name="social_instagram"
                            value={form.socialLinks.instagram}
                            onChange={handleChange}
                            placeholder="https://instagram.com/…"
                            style={inputStyle}
                        />

                        <label style={labelStyle}>YouTube</label>
                        <input
                            type="url"
                            name="social_youtube"
                            value={form.socialLinks.youtube}
                            onChange={handleChange}
                            placeholder="https://youtube.com/…"
                            style={inputStyle}
                        />

                        {/* Actions */}
                        <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    flex: 1,
                                    padding: "12px",
                                    background: "rgba(255,255,255,0.06)",
                                    border: "1px solid rgba(255,255,255,0.12)",
                                    borderRadius: "30px",
                                    color: "rgba(255,255,255,0.7)",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    fontSize: "14px",
                                    letterSpacing: "0.5px",
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={saving}
                                style={{ flex: 2, borderRadius: "30px", padding: "12px", fontWeight: 600, letterSpacing: "0.5px" }}
                            >
                                {saving ? "Saving…" : "Save Changes"}
                            </button>
                        </div>
                    </form>
                ) : (
                    <p style={{ color: "#ff4444", textAlign: "center" }}>{error}</p>
                )}
            </div>
        </div>
    );
}
