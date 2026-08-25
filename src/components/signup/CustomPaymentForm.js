"use client";

import { useState } from "react";
import PayPalCheckout from "@/components/payments/PayPalCheckout";
import StateSelect from "@/components/signup/StateSelect";

// Client-side mirror of the server's MIN/MAX in lib/payments/amount.js —
// purely so the button doesn't render for an obviously-bad amount. The
// server is what actually enforces the bound; see that file's comment.
const MIN_AMOUNT = 1;
const MAX_AMOUNT = 5000;

const ROW_2COL = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px" };
const ROW_4COL = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "15px" };

export default function CustomPaymentForm() {
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        address: "",
        teamName: "",
        location: "",
        amount: "",
        note: "",
    });
    const [state, setState] = useState("");
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError("");
    };

    const parsedAmount = Number(formData.amount);
    const amountValid =
        formData.amount !== "" && !Number.isNaN(parsedAmount) && parsedAmount >= MIN_AMOUNT && parsedAmount <= MAX_AMOUNT;
    const fullName = `${formData.firstName} ${formData.lastName}`.trim();
    const readyForCheckout = fullName && formData.email.trim() && formData.note.trim() && amountValid;

    if (done) {
        return (
            <div className="alert alert-success" role="alert">
                Thank you! Your payment of ${parsedAmount.toFixed(2)} was received.
            </div>
        );
    }

    return (
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
                    placeholder="Phone Number"
                    value={formData.phone}
                    onChange={handleChange}
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
                <input
                    type="text"
                    name="teamName"
                    className="form-control"
                    placeholder="Team Name (or N/A)"
                    value={formData.teamName}
                    onChange={handleChange}
                />
                <StateSelect value={state} onChange={setState} />
                <input
                    type="text"
                    name="location"
                    className="form-control"
                    placeholder="Location (city)"
                    value={formData.location}
                    onChange={handleChange}
                />
                <input
                    type="number"
                    name="amount"
                    className="form-control"
                    placeholder={`Amount * ($${MIN_AMOUNT}–$${MAX_AMOUNT})`}
                    value={formData.amount}
                    onChange={handleChange}
                    min={MIN_AMOUNT}
                    max={MAX_AMOUNT}
                    step="0.01"
                    required
                />
            </div>
            <textarea
                name="note"
                className="form-control"
                placeholder="Comments / Reason for payment *"
                value={formData.note}
                onChange={handleChange}
                rows={2}
                required
            />

            {readyForCheckout ? (
                <PayPalCheckout
                    name={fullName}
                    email={formData.email.trim()}
                    amount={parsedAmount}
                    note={formData.note.trim()}
                    address={formData.address.trim()}
                    state={state}
                    location={formData.location.trim()}
                    teamName={formData.teamName.trim()}
                    onSuccess={() => setDone(true)}
                    onError={(msg) => setError(msg)}
                />
            ) : (
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                    Fill in your name, email, a reason, and a valid amount to continue to PayPal.
                </p>
            )}
        </div>
    );
}
