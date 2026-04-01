"use client";

import { useState, useEffect, useRef } from "react";

const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

// Maps any common day name / abbreviation to JS weekday index (0=Sun…6=Sat)
function parseDayIndex(name) {
    const n = String(name).trim().toLowerCase();
    const map = {
        sunday: 0, sun: 0, su: 0,
        monday: 1, mon: 1, mo: 1,
        tuesday: 2, tue: 2, tu: 2,
        wednesday: 3, wed: 3, we: 3,
        thursday: 4, thu: 4, th: 4,
        friday: 5, fri: 5, fr: 5,
        saturday: 6, sat: 6, sa: 6,
    };
    return map[n];
}

/**
 * WeekdayDatePicker
 *
 * Props:
 *   value       – YYYY-MM-DD string or ""
 *   onChange    – (YYYY-MM-DD) => void
 *   allowedDays – string[] of day names ("Monday", "Saturday", …).
 *                 Empty array or undefined = all days allowed.
 *   className   – extra class(es) for the trigger input
 *   placeholder – text shown when no date selected
 *   label       – optional label rendered above the input
 */
export default function WeekdayDatePicker({
    value,
    onChange,
    allowedDays = [],
    className = "",
    placeholder = "Select date…",
    align = "left",
}) {
    const today = new Date();
    const parsedValue = value ? new Date(value + "T00:00:00") : null;

    const [open, setOpen] = useState(false);
    const [viewYear, setViewYear] = useState(parsedValue ? parsedValue.getFullYear() : today.getFullYear());
    const [viewMonth, setViewMonth] = useState(parsedValue ? parsedValue.getMonth() : today.getMonth());
    const ref = useRef(null);

    // Keep view in sync when the value is changed externally
    useEffect(() => {
        if (value) {
            const d = new Date(value + "T00:00:00");
            setViewYear(d.getFullYear());
            setViewMonth(d.getMonth());
        }
    }, [value]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    // Build the set of allowed weekday indices (0-6). null = all allowed.
    const parsedIndices = allowedDays.map(parseDayIndex).filter((i) => i !== undefined);
    const allowedSet = parsedIndices.length > 0 ? new Set(parsedIndices) : null;

    const isAllowed = (dayNum) => {
        if (!allowedSet) return true;
        const dow = new Date(viewYear, viewMonth, dayNum).getDay();
        return allowedSet.has(dow);
    };

    const isSelected = (dayNum) =>
        parsedValue &&
        parsedValue.getFullYear() === viewYear &&
        parsedValue.getMonth() === viewMonth &&
        parsedValue.getDate() === dayNum;

    const isToday = (dayNum) =>
        today.getFullYear() === viewYear &&
        today.getMonth() === viewMonth &&
        today.getDate() === dayNum;

    const handleDayClick = (dayNum) => {
        if (!isAllowed(dayNum)) return;
        const mm = String(viewMonth + 1).padStart(2, "0");
        const dd = String(dayNum).padStart(2, "0");
        onChange(`${viewYear}-${mm}-${dd}`);
        setOpen(false);
    };

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
        else setViewMonth((m) => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
        else setViewMonth((m) => m + 1);
    };

    // Display string
    const displayValue = parsedValue
        ? parsedValue.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "";

    // Calendar grid
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const cells = Array(firstDow).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <div ref={ref} style={{ position: "relative" }}>
            <input
                readOnly
                className={`admin-form-input ${className}`}
                value={displayValue}
                placeholder={placeholder}
                onClick={() => setOpen((o) => !o)}
                style={{ cursor: "pointer", caretColor: "transparent" }}
            />

            {open && (
                <div style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    ...(align === "right" ? { right: 0 } : { left: 0 }),
                    zIndex: 500,
                    background: "#fff",
                    border: "1px solid #d5d8e0",
                    borderRadius: 8,
                    padding: 12,
                    minWidth: 260,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                }}>
                    {/* Month navigation */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <button
                            type="button"
                            onClick={prevMonth}
                            style={{ background: "none", border: "none", color: "#5a5f72", cursor: "pointer", padding: "2px 8px", fontSize: 16, lineHeight: 1 }}
                        >
                            ‹
                        </button>
                        <span style={{ color: "#1a1d26", fontWeight: 700, fontSize: 13 }}>
                            {MONTH_NAMES[viewMonth]} {viewYear}
                        </span>
                        <button
                            type="button"
                            onClick={nextMonth}
                            style={{ background: "none", border: "none", color: "#5a5f72", cursor: "pointer", padding: "2px 8px", fontSize: 16, lineHeight: 1 }}
                        >
                            ›
                        </button>
                    </div>

                    {/* Day-of-week headers */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
                        {DAY_HEADERS.map((h) => (
                            <div key={h} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#8b90a0", textTransform: "uppercase", letterSpacing: 0.4 }}>
                                {h}
                            </div>
                        ))}
                    </div>

                    {/* Day cells */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
                        {cells.map((day, idx) => {
                            if (!day) return <div key={`e-${idx}`} />;
                            const allowed = isAllowed(day);
                            const selected = isSelected(day);
                            const todayCell = isToday(day);
                            return (
                                <button
                                    key={day}
                                    type="button"
                                    onClick={() => handleDayClick(day)}
                                    disabled={!allowed}
                                    style={{
                                        background: selected ? "#FF1E00" : "none",
                                        border: todayCell && !selected ? "1px solid #FF1E00" : "1px solid transparent",
                                        borderRadius: 5,
                                        color: selected ? "#fff" : allowed ? "#1a1d26" : "#c8cad4",
                                        cursor: allowed ? "pointer" : "not-allowed",
                                        padding: "5px 0",
                                        fontSize: 13,
                                        fontWeight: selected ? 700 : 400,
                                        textAlign: "center",
                                        opacity: allowed ? 1 : 0.45,
                                        pointerEvents: allowed ? "auto" : "none",
                                    }}
                                >
                                    {day}
                                </button>
                            );
                        })}
                    </div>

                    {/* Hint row */}
                    {allowedSet && allowedDays.length > 0 && (
                        <div style={{
                            marginTop: 10,
                            paddingTop: 8,
                            borderTop: "1px solid #f0f1f5",
                            fontSize: 11,
                            color: "#8b90a0",
                        }}>
                            <i className="fa-solid fa-circle-info" style={{ marginRight: 4 }}></i>
                            Games on: {allowedDays.join(", ")}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
