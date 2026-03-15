export function formatOrganizationLocationEntry(entry) {
    if (!entry) return "";

    if (entry.locationName) {
        return entry.locationName;
    }

    if (entry.countyName && (entry.stateAbbr || entry.stateName)) {
        return `${entry.countyName} (${entry.stateAbbr || entry.stateName})`;
    }

    return entry.countyName || entry.stateName || "";
}

export function formatOrganizationLocations(organization) {
    const locations = (organization?.locations || [])
        .map(formatOrganizationLocationEntry)
        .filter(Boolean);

    if (locations.length > 0) {
        return locations.join(", ");
    }

    return organization?.location || "-";
}
