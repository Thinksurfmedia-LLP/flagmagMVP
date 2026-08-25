"use client";

import { useState, useRef, useEffect, useCallback } from "react";

const LIGHT_PALETTE = {
    boxBg: "#fff",
    boxBgDisabled: "#f3f4f6",
    boxBorder: "#d5d8e0",
    valueColor: "#1a1d26",
    placeholderColor: "#a0a4b2",
    arrowColor: "#8b90a0",
    menuBg: "#fff",
    menuBorder: "#d5d8e0",
    itemColor: "#1a1d26",
    itemHoverBg: "#f9fafb",
    itemSelectedBg: "#fff3f2",
};

// Matches this app's dark form-control styling (see .form-control in
// style.css) — used wherever this select sits on a dark signup form
// instead of the light admin-panel background it was originally built for.
const DARK_PALETTE = {
    boxBg: "#16181C",
    boxBgDisabled: "rgba(255,255,255,0.03)",
    boxBorder: "#312D23",
    valueColor: "rgba(255,255,255,0.85)",
    placeholderColor: "rgba(255,255,255,0.4)",
    arrowColor: "rgba(255,255,255,0.5)",
    menuBg: "#1c1e24",
    menuBorder: "#312D23",
    itemColor: "rgba(255,255,255,0.85)",
    itemHoverBg: "rgba(255,255,255,0.06)",
    itemSelectedBg: "rgba(255,30,0,0.18)",
};

export default function SearchableSelect({
    value,
    onChange,
    options,
    placeholder = "Select...",
    disabled = false,
    error = false,
    dark = false,
    style = {},
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const containerRef = useRef(null);
    const palette = dark ? DARK_PALETTE : LIGHT_PALETTE;

    const selectedOption = options.find(o => o.value === value);

    const filtered = query
        ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
        : options;

    useEffect(() => {
        function onClickOutside(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                setQuery("");
            }
        }
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    const handleKeyDown = useCallback((e) => {
        if (!open) return;
        if (e.key === "Escape") {
            setOpen(false);
            setQuery("");
            return;
        }
        if (e.key === "Backspace") {
            setQuery(prev => prev.slice(0, -1));
            return;
        }
        if (e.key.length === 1) {
            setQuery(prev => prev + e.key);
        }
    }, [open]);

    function handleOpen() {
        if (disabled) return;
        setQuery("");
        setOpen(prev => !prev);
    }

    function handleSelect(optValue) {
        onChange(optValue);
        setOpen(false);
        setQuery("");
    }

    return (
        <div
            ref={containerRef}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={handleKeyDown}
            style={{ position: "relative", width: "100%", outline: "none", ...style }}
        >
            <div
                onClick={handleOpen}
                style={{
                    width: "100%",
                    // Dark mode is used exclusively on the signup forms, sitting
                    // next to plain <input className="form-control"> fields —
                    // match that class's box model (style.css .form-control)
                    // exactly, not just its colors, or it reads as a different
                    // control floating in the same row.
                    padding: dark ? "10px 30px 10px 22px" : "7px 28px 7px 10px",
                    borderRadius: dark ? 26 : 6,
                    background: disabled ? palette.boxBgDisabled : palette.boxBg,
                    border: `1px solid ${open ? "#FF1E00" : error ? "#FF1E00" : palette.boxBorder}`,
                    boxShadow: open ? "0 0 0 3px rgba(255, 30, 0, 0.08)" : error ? "0 0 0 3px rgba(255, 30, 0, 0.12)" : "none",
                    color: value ? palette.valueColor : palette.placeholderColor,
                    fontSize: dark ? 16 : 14,
                    fontWeight: dark ? 300 : 400,
                    cursor: disabled ? "not-allowed" : "pointer",
                    userSelect: "none",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    minHeight: dark ? 52 : 36,
                    boxSizing: "border-box",
                    transition: "border-color 0.15s, box-shadow 0.15s, background 0.3s",
                }}
            >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {query && open
                        ? <span style={{ color: palette.valueColor }}>{query}<span style={{ opacity: 0.35 }}>...</span></span>
                        : selectedOption ? selectedOption.label : placeholder
                    }
                </span>
                <span style={{
                    position: "absolute",
                    right: dark ? 22 : 10,
                    top: "50%",
                    transform: `translateY(-50%) ${open ? "rotate(180deg)" : "rotate(0)"}`,
                    transition: "transform 0.2s",
                    fontSize: 10,
                    color: palette.arrowColor,
                    pointerEvents: "none",
                }}>▼</span>
            </div>

            {open && (
                <div style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    background: palette.menuBg,
                    border: `1px solid ${palette.menuBorder}`,
                    borderRadius: dark ? 14 : 6,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                    zIndex: 9999,
                    overflow: "hidden",
                }}>
                    <div style={{ maxHeight: 220, overflowY: "auto" }}>
                        <div
                            onClick={() => handleSelect("")}
                            style={{ padding: "8px 12px", cursor: "pointer", fontSize: 14, color: palette.placeholderColor }}
                            onMouseEnter={e => e.currentTarget.style.background = palette.itemHoverBg}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                            {placeholder}
                        </div>
                        {filtered.length === 0 ? (
                            <div style={{ padding: "8px 12px", color: palette.placeholderColor, fontSize: 13 }}>No results</div>
                        ) : (
                            filtered.map(o => (
                                <div
                                    key={o.value}
                                    onClick={() => handleSelect(o.value)}
                                    style={{
                                        padding: "8px 12px",
                                        cursor: "pointer",
                                        fontSize: 14,
                                        color: palette.itemColor,
                                        background: value === o.value ? palette.itemSelectedBg : "transparent",
                                        fontWeight: value === o.value ? 600 : 400,
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = palette.itemHoverBg}
                                    onMouseLeave={e => e.currentTarget.style.background = value === o.value ? palette.itemSelectedBg : "transparent"}
                                >
                                    {o.label}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
