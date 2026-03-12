"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirectTo = searchParams.get("redirect") || "/";
    const justRegistered = searchParams.get("registered") === "true";
    const { login } = useAuth();

    const [formData, setFormData] = useState({ email: "", password: "" });
    const [remember, setRemember] = useState(true);
    const [error, setError] = useState("");
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
                    router.push(redirectTo);
                    router.refresh();
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
                />
                <input
                    type="password"
                    name="password"
                    className="form-control"
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
                >
                    {loading ? "Signing in..." : "Sign in"}
                </button>
                <p className="text-center mt-3" style={{ fontSize: '14px' }}>
                    Don&apos;t have an account?{' '}
                    <a href="/signup" style={{ color: '#FF1E00', textDecoration: 'none', fontWeight: 600 }}>
                        Sign up here
                    </a>
                </p>
            </div>
        </form>
    );
}
