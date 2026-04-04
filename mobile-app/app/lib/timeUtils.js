/**
 * Timezone utilities — game times are stored in PST/PDT and displayed as-is.
 */

/**
 * Format a "HH:MM" 24-hour string to "h:mm AM/PM PDT" for display.
 */
export function formatTimePDT(timeStr) {
    if (!timeStr) return "";
    const [hStr, mStr] = timeStr.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const ampm = h < 12 ? "AM" : "PM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm} PDT`;
}

/**
 * Format a UTC Date (or ISO string) as a readable date in PST/PDT.
 */
export function formatDatePST(dateInput, options = {}) {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    return d.toLocaleDateString("en-US", {
        timeZone: "America/Los_Angeles",
        month: "short",
        day: "numeric",
        ...options,
    });
}
