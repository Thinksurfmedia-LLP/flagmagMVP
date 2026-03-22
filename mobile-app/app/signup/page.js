"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthProvider, useAuth } from "../lib/AuthContext";

function SignupForm() {
    const router = useRouter();
    const { signup } = useAuth();
    const [form, setForm] = useState({
        name: "",
        phone: "",
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (form.password !== form.confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (form.password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        setLoading(true);
        try {
            await signup({
                name: form.name,
                phone: form.phone,
                email: form.email,
                password: form.password,
            });
            router.push("/matches");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="wrapper">
            <div className="main-section-wrapper login-page login2">
                <div className="content-wrapper">
                    <header>
                        <div className="back-btn-area">
                            <button onClick={() => router.back()}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M19 12H5M12 19l-7-7 7-7" />
                                </svg>
                            </button>
                        </div>
                    </header>

                    <div className="content-area">
                        <h2>We say Hello!</h2>
                        <p>Create your account to start recording game stats.</p>
                    </div>

                    {error && <div className="toast-message error">{error}</div>}

                    <form className="form-area" onSubmit={handleSubmit}>
                        <input
                            type="text"
                            className="form-control icon-user"
                            placeholder="Full Name"
                            value={form.name}
                            onChange={update("name")}
                            required
                        />
                        <input
                            type="tel"
                            className="form-control icon-phone"
                            placeholder="Phone Number"
                            value={form.phone}
                            onChange={update("phone")}
                            required
                        />
                        <input
                            type="email"
                            className="form-control icon-email"
                            placeholder="Email"
                            value={form.email}
                            onChange={update("email")}
                            required
                        />
                        <div className="password-group">
                            <input
                                type={showPw ? "text" : "password"}
                                className="form-control icon-password"
                                placeholder="Password"
                                value={form.password}
                                onChange={update("password")}
                                required
                            />
                            <button type="button" onClick={() => setShowPw(!showPw)}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF1E00" strokeWidth="2">
                                    {showPw ? (
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 100 6 3 3 0 000-6z" />
                                    ) : (
                                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24 M1 1l22 22" />
                                    )}
                                </svg>
                            </button>
                        </div>
                        <input
                            type="password"
                            className="form-control icon-password"
                            placeholder="Re-Enter Password"
                            value={form.confirmPassword}
                            onChange={update("confirmPassword")}
                            required
                        />
                        <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                            {loading ? "Signing up..." : "Sign Up"}
                        </button>
                    </form>

                    <div className="social-login-area">
                        <h5>or sign up with</h5>
                        <ul>
                            <li><a href="#"><img src="/assets/images/fb.png" alt="Facebook" /></a></li>
                            <li><a href="#"><img src="/assets/images/go.png" alt="Google" /></a></li>
                        </ul>
                    </div>

                    <div className="auth-link">
                        <h6>Already have an account? <Link href="/login">Log In</Link></h6>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function SignupPage() {
    return (
        <AuthProvider>
            <SignupForm />
        </AuthProvider>
    );
}
