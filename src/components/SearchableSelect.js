"use client";

import { useState, useRef, useEffect, useCallback } from "react";

export default function SearchableSelect({
    value,
    onChange,
    options,
    placeholder = "Select...",
    disabled = false,
    error = false,
    style = {},
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const containerRef = useRef(null);

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
                    padding: "7px 28px 7px 10px",
                    borderRadius: 6,
                    background: disabled ? "#f3f4f6" : "#fff",
                    border: `1px solid ${open ? "#FF1E00" : error ? "#FF1E00" : "#d5d8e0"}`,
                    boxShadow: open ? "0 0 0 3px rgba(255, 30, 0, 0.08)" : error ? "0 0 0 3px rgba(255, 30, 0, 0.12)" : "none",
                    color: value ? "#1a1d26" : "#a0a4b2",
                    fontSize: 14,
                    cursor: disabled ? "not-allowed" : "pointer",
                    userSelect: "none",
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    minHeight: 36,
                    boxSizing: "border-box",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                }}
            >
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {query && open
                        ? <span style={{ color: "#1a1d26" }}>{query}<span style={{ opacity: 0.35 }}>...</span></span>
                        : selectedOption ? selectedOption.label : placeholder
                    }
                </span>
                <span style={{
                    position: "absolute",
                    right: 10,
                    top: "50%",
                    transform: `translateY(-50%) ${open ? "rotate(180deg)" : "rotate(0)"}`,
                    transition: "transform 0.2s",
                    fontSize: 10,
                    color: "#8b90a0",
                    pointerEvents: "none",
                }}>▼</span>
            </div>

            {open && (
                <div style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    background: "#fff",
                    border: "1px solid #d5d8e0",
                    borderRadius: 6,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                    zIndex: 9999,
                    overflow: "hidden",
                }}>
                    <div style={{ maxHeight: 220, overflowY: "auto" }}>
                        <div
                            onClick={() => handleSelect("")}
                            style={{ padding: "8px 12px", cursor: "pointer", fontSize: 14, color: "#a0a4b2" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                            {placeholder}
                        </div>
                        {filtered.length === 0 ? (
                            <div style={{ padding: "8px 12px", color: "#a0a4b2", fontSize: 13 }}>No results</div>
                        ) : (
                            filtered.map(o => (
                                <div
                                    key={o.value}
                                    onClick={() => handleSelect(o.value)}
                                    style={{
                                        padding: "8px 12px",
                                        cursor: "pointer",
                                        fontSize: 14,
                                        color: "#1a1d26",
                                        background: value === o.value ? "#fff3f2" : "transparent",
                                        fontWeight: value === o.value ? 600 : 400,
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                                    onMouseLeave={e => e.currentTarget.style.background = value === o.value ? "#fff3f2" : "transparent"}
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
