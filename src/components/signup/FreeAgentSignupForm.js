"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import PasswordInput from "@/components/ui/PasswordInput";
import OrganizationPicker from "@/components/signup/OrganizationPicker";
import LeaguePicker from "@/components/signup/LeaguePicker";
import StateSelect from "@/components/signup/StateSelect";

const ROW_2COL = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" };
const ROW_4COL = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "15px" };

export default function FreeAgentSignupForm() {
    const router = useRouter();
    const { refreshUser } = useAuth();
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        location: "",
        password: "",
        confirmPassword: "",
        notes: "",
    });
    const [organizationId, setOrganizationId] = useState("");
    const [organizationSlug, setOrganizationSlug] = useState("");
    const [requestedLeagueId, setRequestedLeagueId] = useState("");
    const [state, setState] = useState("");
    const [agreed, setAgreed] = useState(true);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleOrgChange = (id, slug) => {
        setOrganizationId(id);
        setOrganizationSlug(slug);
        setRequestedLeagueId("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        if (!agreed) {
            setError("You must agree to the Terms & Conditions");
            return;
        }
        if (!organizationId) {
            setError("Please select a league to join");
            return;
        }
        // Division is intentionally NOT required here — some leagues have
        // no divisions configured yet, in which case the picker below has
        // nothing selectable at all. Requiring it would make signup
        // permanently impossible for that league. Matches the server,
        // which already treats requestedLeagueId as optional.
        if (!state) {
            setError("Please select your state");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/auth/register/free-agent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: `${formData.firstName} ${formData.lastName}`.trim(),
                    email: formData.email,
                    phone: formData.phone,
                    password: formData.password,
                    confirmPassword: formData.confirmPassword,
                    organizationId,
                    requestedLeagueId,
                    address: formData.address,
                    state,
                    location: formData.location,
                    notes: formData.notes,
                }),
            });
            const data = await res.json();

            if (!data.success) {
                setError(data.error);
            } else {
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
                <div style={ROW_2COL}>
                    <input
                        type="text"
                        name="firstName"
                        className="form-control"
                        placeholder="First Name *"
                        value={formData.firstName}
                        onChange={handleChange}
                        required
                    />
                    <input
                        type="text"
                        name="lastName"
                        className="form-control"
                        placeholder="Last Name *"
                        value={formData.lastName}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div style={ROW_2COL}>
                    <input
                        type="email"
                        name="email"
                        className="form-control"
                        placeholder="Email *"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        suppressHydrationWarning
                    />
                    <input
                        type="tel"
                        name="phone"
                        className="form-control"
                        placeholder="Phone Number *"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                    />
                </div>
                <textarea
                    name="address"
                    className="form-control"
                    placeholder="Address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={2}
                />
                <div style={ROW_4COL}>
                    <OrganizationPicker value={organizationId} onChange={handleOrgChange} />
                    <LeaguePicker orgSlug={organizationSlug} value={requestedLeagueId} onChange={setRequestedLeagueId} />
                    <StateSelect value={state} onChange={setState} />
                    <input
                        type="text"
                        name="location"
                        className="form-control"
                        placeholder="Location (city)"
                        value={formData.location}
                        onChange={handleChange}
                    />
                </div>
                <div style={ROW_2COL}>
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
                </div>
                <textarea
                    name="notes"
                    className="form-control"
                    placeholder="Any Special Details, Questions, Comments?"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
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
                <div style={{ textAlign: "center" }}>
                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading}
                        style={{ borderRadius: "30px", padding: "12px 48px", fontWeight: "600", letterSpacing: "0.5px" }}
                    >
                        {loading ? "SUBMITTING..." : "SUBMIT"}
                    </button>
                </div>
            </div>
        </form>
    );
}
