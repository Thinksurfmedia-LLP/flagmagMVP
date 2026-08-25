"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import PasswordInput from "@/components/ui/PasswordInput";

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
            <div className="form-area" style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
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
                <PasswordInput
                    name="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={6}
                />
                <PasswordInput
                    name="confirmPassword"
                    placeholder="Confirm Password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                />
                <div className="agree-check" style={{ color: "rgba(255,255,255,0.72)", fontSize: "14px" }}>
                    <input
                        type="checkbox"
                        id="agree"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                    />
                    <label htmlFor="agree">
                        By signing up, I have read and agree to FlagMag&apos;s{" "}
                        <Link href="#" style={{ color: "#FF1E00" }}>Terms &amp; Conditions</Link> and{" "}
                        <Link href="#" style={{ color: "#FF1E00" }}>Privacy Policy</Link>
                    </label>
                </div>
                <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={loading}
                    style={{ borderRadius: "30px", padding: "12px", fontWeight: "600", letterSpacing: "0.5px" }}
                >
                    {loading ? "SIGNING UP..." : "SIGN UP"}
                </button>
            </div>
        </form>
    );
}
