"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthProvider, useAuth } from "../lib/AuthContext";

function LoginForm() {
    const router = useRouter();
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await login(email, password);
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
                        <p>Sign in to start recording game stats and managing your games.</p>
                    </div>

                    {error && <div className="toast-message error">{error}</div>}

                    <form className="form-area" onSubmit={handleSubmit}>
                        <input
                            type="email"
                            className="form-control icon-email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                        <div className="password-group">
                            <input
                                type={showPw ? "text" : "password"}
                                className="form-control icon-password"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
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
                        <span className="forgot-pass">
                            <a href="#">Forgot password?</a>
                        </span>
                        <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                            {loading ? "Logging in..." : "Log In"}
                        </button>
                    </form>

                    <div className="social-login-area">
                        <h5>or log in with</h5>
                        <ul>
                            <li><a href="#"><img src="/assets/images/fb.png" alt="Facebook" /></a></li>
                            <li><a href="#"><img src="/assets/images/go.png" alt="Google" /></a></li>
                        </ul>
                    </div>

                    <div className="auth-link">
                        <h6>Don&apos;t have an account? <Link href="/signup">Sign Up</Link></h6>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <AuthProvider>
            <LoginForm />
        </AuthProvider>
    );
}
