"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import PasswordInput from "@/components/ui/PasswordInput";

export default function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get("redirect") || "/";
    const justRegistered = searchParams.get("registered") === "true";
    const sessionExpired = searchParams.get("expired") === "true";
    const { login } = useAuth();

    const [formData, setFormData] = useState({ email: "", password: "" });
    const [remember, setRemember] = useState(true);
    const [error, setError] = useState(sessionExpired ? "Your session has expired. Please log in again." : "");
    const [success, setSuccess] = useState(justRegistered ? "Account created! Please log in." : "");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");
        setLoading(true);

        try {
            const data = await login(formData.email, formData.password);

            if (!data.success) {
                setError(data.error);
            } else {
                setSuccess(`Welcome back, ${data.data.name}!`);
                setTimeout(() => {
                    // Hard navigation to fully reset all component state
                    // (prevents stale sidebar/logo from previous user session)
                    const allRoles = data.data.roles?.length ? data.data.roles : [data.data.role];
                    if (allRoles.includes("player") && data.data.playerId) {
                        window.location.href = `/players/${data.data.playerId}`;
                    } else {
                        window.location.href = redirectTo;
                    }
                }, 1000);
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
                {success && (
                    <div className="alert alert-success py-2" role="alert">
                        {success}
                    </div>
                )}
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
                <PasswordInput
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                />
                <div className="agree-check">
                    <input
                        type="checkbox"
                        id="remember"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                    />
                    <label htmlFor="remember">Remember me</label>
                </div>
                <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={loading}
                    style={{ borderRadius: "30px", padding: "12px", fontWeight: "600", letterSpacing: "0.5px" }}
                >
                    {loading ? "SIGNING IN..." : "SIGN IN"}
                </button>
                {/* <p className="text-center mt-3" style={{ fontSize: '14px' }}>
                    Don&apos;t have an account?{' '}
                    <Link href="/signup" style={{ color: '#FF1E00', textDecoration: 'none', fontWeight: 600 }}>
                        Get started
                    </Link>
                </p> */}
            </div>
        </form>
    );
}
