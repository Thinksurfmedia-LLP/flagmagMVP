"use client";

import { useState } from "react";

const PHONE_CODES = [
    { code: "+1", flag: "🇺🇸", label: "US/CA" },
    { code: "+44", flag: "🇬🇧", label: "UK" },
    { code: "+91", flag: "🇮🇳", label: "IN" },
    { code: "+61", flag: "🇦🇺", label: "AU" },
    { code: "+971", flag: "🇦🇪", label: "AE" },
    { code: "+966", flag: "🇸🇦", label: "SA" },
    { code: "+49", flag: "🇩🇪", label: "DE" },
    { code: "+33", flag: "🇫🇷", label: "FR" },
    { code: "+55", flag: "🇧🇷", label: "BR" },
    { code: "+52", flag: "🇲🇽", label: "MX" },
];

const EMPTY_FORM = {
    fullName: "",
    workEmail: "",
    phoneCode: "+1",
    phoneNumber: "",
    organizationName: "",
    preferredDateTime: "",
    agreedToContact: false,
};

export default function BookDemoModal({ isOpen, onClose }) {
    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    if (!isOpen) return null;

    const validate = () => {
        const errs = {};
        if (!form.fullName.trim()) errs.fullName = "Full name is required";
        if (!form.workEmail.trim()) {
            errs.workEmail = "Work email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.workEmail)) {
            errs.workEmail = "Enter a valid email address";
        }
        if (!form.phoneNumber.trim()) {
            errs.phoneNumber = "Phone number is required";
        } else if (!/^\d{6,15}$/.test(form.phoneNumber.replace(/\s/g, ""))) {
            errs.phoneNumber = "Enter a valid phone number";
        }
        if (!form.organizationName.trim()) errs.organizationName = "Organization name is required";
        if (!form.agreedToContact) errs.agreedToContact = "You must agree to be contacted";
        return errs;
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length > 0) { setErrors(errs); return; }

        setSubmitting(true);
        try {
            const res = await fetch("/api/demo-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: form.fullName.trim(),
                    workEmail: form.workEmail.trim(),
                    phone: `${form.phoneCode} ${form.phoneNumber.trim()}`,
                    organizationName: form.organizationName.trim(),
                    preferredDateTime: form.preferredDateTime.trim(),
                    agreedToContact: form.agreedToContact,
                }),
            });
            const data = await res.json();
            if (data.success) {
                setSubmitted(true);
            } else {
                setErrors({ _server: data.error || "Something went wrong. Please try again." });
            }
        } catch {
            setErrors({ _server: "Network error. Please try again." });
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setForm(EMPTY_FORM);
        setErrors({});
        setSubmitted(false);
        onClose();
    };

    return (
        <div className="book-demo-overlay">
            <div className="book-demo-modal">
                <button className="book-demo-close" onClick={handleClose} aria-label="Close">
                    <i className="fa-solid fa-xmark"></i>
                </button>

                {submitted ? (
                    <div className="book-demo-success">
                        <div className="book-demo-success-icon">
                            <i className="fa-solid fa-circle-check"></i>
                        </div>
                        <h3>Request Submitted!</h3>
                        <p>Thanks, <strong>{form.fullName}</strong>! We&apos;ve received your demo request and will reach out to you soon.</p>
                        <button className="btn btn-primary" onClick={handleClose}>Close</button>
                    </div>
                ) : (
                    <>
                        {/* <div className="book-demo-header">
                            <h3>Book a Demo</h3>
                            <p>Fill in the details below and our team will reach out to schedule your demo.</p>
                        </div> */}

                        <form onSubmit={handleSubmit} noValidate className="book-demo-form">
                            {errors._server && (
                                <div className="book-demo-error-banner">{errors._server}</div>
                            )}

                            {/* Full Name */}
                            <div className="book-demo-field">
                                <label>Full Name <span>*</span></label>
                                <input
                                    type="text"
                                    name="fullName"
                                    value={form.fullName}
                                    onChange={handleChange}
                                    placeholder="John Smith"
                                    className={errors.fullName ? "error" : ""}
                                />
                                {errors.fullName && <span className="book-demo-field-error">{errors.fullName}</span>}
                            </div>

                            {/* Work Email */}
                            <div className="book-demo-field">
                                <label>Work Email <span>*</span></label>
                                <input
                                    type="email"
                                    name="workEmail"
                                    value={form.workEmail}
                                    onChange={handleChange}
                                    placeholder="you@yourcompany.com"
                                    className={errors.workEmail ? "error" : ""}
                                />
                                {errors.workEmail && <span className="book-demo-field-error">{errors.workEmail}</span>}
                            </div>

                            {/* Phone */}
                            <div className="book-demo-field">
                                <label>Phone Number <span>*</span></label>
                                <div className="book-demo-phone">
                                    <select name="phoneCode" value={form.phoneCode} onChange={handleChange}>
                                        {PHONE_CODES.map((c) => (
                                            <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="tel"
                                        name="phoneNumber"
                                        value={form.phoneNumber}
                                        onChange={handleChange}
                                        placeholder="555 000 0000"
                                        className={errors.phoneNumber ? "error" : ""}
                                    />
                                </div>
                                {errors.phoneNumber && <span className="book-demo-field-error">{errors.phoneNumber}</span>}
                            </div>

                            {/* Organization Name */}
                            <div className="book-demo-field">
                                <label>Organization Name <span>*</span></label>
                                <input
                                    type="text"
                                    name="organizationName"
                                    value={form.organizationName}
                                    onChange={handleChange}
                                    placeholder="Your League / Club"
                                    className={errors.organizationName ? "error" : ""}
                                />
                                {errors.organizationName && <span className="book-demo-field-error">{errors.organizationName}</span>}
                            </div>

                            {/* Preferred Date & Time */}
                            <div className="book-demo-field">
                                <label>Preferred Date &amp; Time</label>
                                <input
                                    type="datetime-local"
                                    name="preferredDateTime"
                                    value={form.preferredDateTime}
                                    onChange={handleChange}
                                    min={new Date().toISOString().slice(0, 16)}
                                />
                            </div>

                            {/* Agree checkbox */}
                            <div className="book-demo-field book-demo-checkbox">
                                <label className={errors.agreedToContact ? "error" : ""}>
                                    <input
                                        type="checkbox"
                                        name="agreedToContact"
                                        checked={form.agreedToContact}
                                        onChange={handleChange}
                                    />
                                    <span>I agree to be contacted by the FlagMag team regarding this demo request.</span>
                                </label>
                                {errors.agreedToContact && <span className="book-demo-field-error">{errors.agreedToContact}</span>}
                            </div>

                            <button type="submit" className="btn btn-primary book-demo-submit" disabled={submitting}>
                                {submitting ? (
                                    <><i className="fa-solid fa-spinner fa-spin"></i>&nbsp; Submitting...</>
                                ) : (
                                    <>Submit Request <span><img src="/assets/images/btn-arrow.png" alt="" /></span></>
                                )}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
