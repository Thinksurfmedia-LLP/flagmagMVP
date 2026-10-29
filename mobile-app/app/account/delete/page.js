"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth, loginPath } from "../../lib/AuthContext";

function DeleteAccountForm() {
    const router = useRouter();
    const { user, loading: authLoading, sessionEnded, deleteAccount } = useAuth();
    const [password, setPassword] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) router.push(loginPath("/account/delete", sessionEnded));
    }, [authLoading, user, sessionEnded, router]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await deleteAccount(password);
            router.replace("/welcome?deleted=true");
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    if (authLoading || !user) return null;

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
                        <h2>Delete Account</h2>
                        <p>This permanently deletes your FlagMag account ({user.email}) on the app and the website. It can&apos;t be undone.</p>
                        <ul style={{ textAlign: "left", paddingLeft: "20px", marginTop: "12px", fontSize: "14px" }}>
                            <li>Your login, name, email, phone and profile picture are deleted.</li>
                            <li>Your activity history is deleted.</li>
                            <li>Games and stats you recorded stay with their teams and leagues.</li>
                            <li>Payment records are kept for accounting, without a link to your account.</li>
                        </ul>
                    </div>

                    {error && <div className="toast-message error">{error}</div>}

                    <form className="form-area" onSubmit={handleSubmit}>
                        <input
                            type="password"
                            className="form-control icon-password"
                            placeholder="Enter your password to confirm"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <label style={{ display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "14px", margin: "4px 0 16px" }}>
                            <input
                                type="checkbox"
                                checked={confirmed}
                                onChange={(e) => setConfirmed(e.target.checked)}
                                style={{ marginTop: "3px" }}
                            />
                            I understand my account will be permanently deleted.
                        </label>
                        <button type="submit" className="btn btn-primary w-100" disabled={loading || !confirmed || !password}>
                            {loading ? "Deleting..." : "Delete My Account"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default function DeleteAccountPage() {
    return (
        <AuthProvider>
            <DeleteAccountForm />
        </AuthProvider>
    );
}
