"use client";

import { useState } from "react";

/**
 * Password input with a show/hide eye toggle. Extracted from LoginForm.js /
 * SignupForm.js where this markup was duplicated verbatim — new forms should
 * use this instead of re-copying the SVG icons.
 */
export default function PasswordInput({ name, placeholder, value, onChange, required, minLength }) {
    const [visible, setVisible] = useState(false);

    return (
        <div style={{ position: "relative" }}>
            <input
                type={visible ? "text" : "password"}
                name={name}
                className="form-control"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                required={required}
                minLength={minLength}
                style={{ paddingRight: "42px" }}
            />
            <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, color: "#8b90a0", display: "flex", alignItems: "center" }}
                tabIndex={-1}
                aria-label={visible ? "Hide password" : "Show password"}
            >
                {visible ? (
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
    );
}
