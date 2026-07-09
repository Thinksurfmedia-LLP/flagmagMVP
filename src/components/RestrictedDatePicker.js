"use client";

import { useState, useRef, useEffect } from "react";

const DAY_NAME_TO_INDEX = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
};

const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function parseDayIndices(scheduleDays) {
    if (!scheduleDays || scheduleDays.length === 0) return null;
    const indices = scheduleDays
        .map(d => DAY_NAME_TO_INDEX[d.toLowerCase()])
        .filter(n => n !== undefined);
    return indices.length > 0 ? indices : null;
}

function toYMD(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseYMD(str) {
    if (!str) return null;
    const parts = str.slice(0, 10).split("-").map(Number);
    if (parts.length < 3) return null;
    return { year: parts[0], month: parts[1] - 1, day: parts[2] };
}

export default function RestrictedDatePicker({
    value = "",
    onChange,
    scheduleDays = [],
    minDate = null,
    maxDate = null,
    error = false,
    disabled = false,
    placeholder = "Select date",
    style = {},
}) {
    const today = new Date();
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    const allowedDays = parseDayIndices(scheduleDays);

    function getInitialView() {
        if (value) {
            const p = parseYMD(value);
            if (p) return { year: p.year, month: p.month };
        }
        // Default to the current month, clamped within [minDate, maxDate] if needed.
        let view = { year: today.getFullYear(), month: today.getMonth() };
        if (minDate) {
            const p = parseYMD(minDate);
            if (p && (view.year < p.year || (view.year === p.year && view.month < p.month))) {
                view = { year: p.year, month: p.month };
            }
        }
        if (maxDate) {
            const p = parseYMD(maxDate);
            if (p && (view.year > p.year || (view.year === p.year && view.month > p.month))) {
                view = { year: p.year, month: p.month };
            }
        }
        return view;
    }

    const init = getInitialView();
    const [viewYear, setViewYear] = useState(init.year);
    const [viewMonth, setViewMonth] = useState(init.month);

    useEffect(() => {
        function handler(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        if (value) {
            const p = parseYMD(value);
            if (p) { setViewYear(p.year); setViewMonth(p.month); }
        }
    }, [value]);

    useEffect(() => {
        if (!minDate) return;
        const p = parseYMD(minDate);
        if (!p) return;
        const before = viewYear < p.year || (viewYear === p.year && viewMonth < p.month);
        if (before) { setViewYear(p.year); setViewMonth(p.month); }
    }, [minDate]);

    function isDisabled(year, month, day) {
        const str = toYMD(year, month, day);
        if (minDate && str < minDate.slice(0, 10)) return true;
        if (maxDate && str > maxDate.slice(0, 10)) return true;
        if (allowedDays) {
            const dow = new Date(year, month, day).getDay();
            if (!allowedDays.includes(dow)) return true;
        }
        return false;
    }

    function handleDayClick(day) {
        if (isDisabled(viewYear, viewMonth, day)) return;
        onChange(toYMD(viewYear, viewMonth, day));
        setOpen(false);
    }

    function prevMonth() {
        if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
        else setViewMonth(m => m - 1);
    }

    function nextMonth() {
        if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
        else setViewMonth(m => m + 1);
    }

    const canGoPrev = (() => {
        if (!minDate) return true;
        const p = parseYMD(minDate);
        if (!p) return true;
        return viewYear > p.year || (viewYear === p.year && viewMonth > p.month);
    })();

    const canGoNext = (() => {
        if (!maxDate) return true;
        const p = parseYMD(maxDate);
        if (!p) return true;
        return viewYear < p.year || (viewYear === p.year && viewMonth < p.month);
    })();

    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const navBtnBase = {
        background: "none",
        border: "none",
        fontSize: 18,
        padding: "2px 8px",
        borderRadius: 4,
        lineHeight: 1,
        fontWeight: 600,
    };

    return (
        <div ref={containerRef} style={{ position: "relative", width: "100%", ...style }}>
            <div
                onClick={() => !disabled && setOpen(p => !p)}
                style={{
                    width: "100%",
                    padding: "7px 28px 7px 10px",
                    borderRadius: 6,
                    background: disabled ? "#f3f4f6" : "#fff",
                    border: `1px solid ${open ? "#FF1E00" : error ? "#FF1E00" : "#d5d8e0"}`,
                    boxShadow: open
                        ? "0 0 0 3px rgba(255,30,0,0.08)"
                        : error ? "0 0 0 3px rgba(255,30,0,0.12)" : "none",
                    color: value ? "#1a1d26" : "#a0a4b2",
                    fontSize: 14,
                    cursor: disabled ? "not-allowed" : "pointer",
                    userSelect: "none",
                    display: "flex",
                    alignItems: "center",
                    minHeight: 36,
                    boxSizing: "border-box",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                    position: "relative",
                }}
            >
                <span style={{ flex: 1 }}>{value || placeholder}</span>
                <span style={{
                    position: "absolute",
                    right: 9,
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
                    background: "#fff",
                    border: "1px solid #d5d8e0",
                    borderRadius: 8,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                    zIndex: 9999,
                    padding: "12px 10px",
                    minWidth: 252,
                }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <button
                            onClick={prevMonth}
                            disabled={!canGoPrev}
                            style={{
                                ...navBtnBase,
                                opacity: canGoPrev ? 1 : 0.25,
                                cursor: canGoPrev ? "pointer" : "not-allowed",
                                color: "#1a1d26",
                            }}
                        >‹</button>
                        <span style={{ fontWeight: 700, fontSize: 13, color: "#1a1d26" }}>
                            {MONTH_NAMES[viewMonth]} {viewYear}
                        </span>
                        <button
                            onClick={nextMonth}
                            disabled={!canGoNext}
                            style={{
                                ...navBtnBase,
                                opacity: canGoNext ? 1 : 0.25,
                                cursor: canGoNext ? "pointer" : "not-allowed",
                                color: "#1a1d26",
                            }}
                        >›</button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 6 }}>
                        {DAY_LABELS.map(d => (
                            <div key={d} style={{
                                textAlign: "center",
                                fontSize: 11,
                                fontWeight: 700,
                                color: "#8b90a0",
                                padding: "2px 0",
                                letterSpacing: "0.04em",
                            }}>{d}</div>
                        ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1 }}>
                        {Array(firstDow).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                            const dayDisabled = isDisabled(viewYear, viewMonth, day);
                            const selected = value === toYMD(viewYear, viewMonth, day);
                            return (
                                <div
                                    key={day}
                                    onClick={() => !dayDisabled && handleDayClick(day)}
                                    style={{
                                        textAlign: "center",
                                        padding: "6px 2px",
                                        borderRadius: 4,
                                        fontSize: 13,
                                        cursor: dayDisabled ? "not-allowed" : "pointer",
                                        background: selected ? "#FF1E00" : "transparent",
                                        color: dayDisabled ? "#ccc" : selected ? "#fff" : "#1a1d26",
                                        fontWeight: selected ? 700 : 400,
                                        transition: "background 0.1s",
                                    }}
                                    onMouseEnter={e => {
                                        if (!dayDisabled && !selected)
                                            e.currentTarget.style.background = "#f5f5f5";
                                    }}
                                    onMouseLeave={e => {
                                        if (!dayDisabled && !selected)
                                            e.currentTarget.style.background = "transparent";
                                    }}
                                >
                                    {day}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
