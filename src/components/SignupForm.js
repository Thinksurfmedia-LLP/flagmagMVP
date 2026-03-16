"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

export default function SignupForm() {
    const router = useRouter();
    const { refreshUser } = useAuth();
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [agreed, setAgreed] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!agreed) {
            setError("You must agree to the Terms & Conditions");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            const data = await res.json();

            if (!data.success) {
                setError(data.error);
            } else {
                // Registration successful — refresh auth state and redirect
                await refreshUser();
                router.push("/");
                router.refresh();
            }
        } catch (err) {
            setError("Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <div className="form-area">
                {error && (
                    <div className="alert alert-danger py-2" role="alert">
                        {error}
                    </div>
                )}
                <input
                    type="text"
                    name="name"
                    className="form-control"
                    placeholder="Full name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                />
                <input
                    type="tel"
                    name="phone"
                    className="form-control"
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChange={handleChange}
                />
                <input
                    type="email"
                    name="email"
                    className="form-control"
                    placeholder="Email Address"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    suppressHydrationWarning
                />
                <div style={{ position: "relative" }}>
                <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    className="form-control"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                    style={{ paddingRight: "42px" }}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, color: "#8b90a0", display: "flex", alignItems: "center" }}
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                >
                    {showPassword ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    )}
                </button>
                </div>
                <div style={{ position: "relative" }}>
                <input
                    type={showConfirm ? "text" : "password"}
                    name="confirmPassword"
                    className="form-control"
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    style={{ paddingRight: "42px" }}
                />
                <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, color: "#8b90a0", display: "flex", alignItems: "center" }}
                    tabIndex={-1}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                    {showConfirm ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                            <line x1="1" y1="1" x2="23" y2="23"/>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    )}
                </button>
                </div>
                <div className="agree-check">
                    <input
                        type="checkbox"
                        id="agree"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                    />
                    <label htmlFor="agree">
                        By signing up, I have read and agree to Untitled UI&apos;s{" "}
                        <Link href="#">Terms &amp; Conditions</Link> and{" "}
                        <Link href="#">Privacy Policy</Link>
                    </label>
                </div>
                <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={loading}
                >
                    {loading ? "Signing up..." : "Sign up"}
                </button>
            </div>
        </form>
    );
}
