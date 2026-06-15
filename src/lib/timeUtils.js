/**
 * Timezone utilities — game times are stored as wall-clock strings and displayed in the org's timezone.
 */

/**
 * Format a "HH:MM" 24-hour string to "h:mm AM/PM TZ" for display.
 * The timezone abbreviation (PDT, EST, CT, etc.) is derived dynamically from the IANA timezone name.
 * Returns the original string untouched if it can't be parsed.
 */
export function formatTimePDT(timeStr, timezone = "America/Los_Angeles", gameDate = null) {
    if (!timeStr) return "";
    const [hStr, mStr] = timeStr.split(":");
    const h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (isNaN(h) || isNaN(m)) return timeStr;
    const ampm = h < 12 ? "AM" : "PM";
    const h12 = h % 12 || 12;
    // Use the game's own date for DST lookup so the abbreviation is correct
    // for that specific date (e.g. PDT in summer, PST in winter), not today's.
    const refDate = gameDate ? new Date(gameDate) : new Date();
    let tzAbbr = "";
    try {
        tzAbbr = new Intl.DateTimeFormat("en-US", { timeZone: timezone, timeZoneName: "short" })
            .formatToParts(refDate)
            .find((p) => p.type === "timeZoneName")?.value || "";
    } catch {
        tzAbbr = "";
    }
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}${tzAbbr ? ` ${tzAbbr}` : ""}`;
}

/**
 * Format a UTC Date (or ISO string) as a readable date.
 * Uses timeZone:"UTC" to prevent the midnight-UTC=previous-day bug for US timezones.
 */
export function formatDatePST(dateInput, options = {}) {
    if (!dateInput) return "";
    const d = new Date(dateInput);
    return d.toLocaleDateString("en-US", {
        timeZone: "UTC",
        weekday: "short",
        month: "short",
        day: "2-digit",
        ...options,
    });
}
