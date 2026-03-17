export function formatOrganizationLocationEntry(entry) {
    if (!entry) return "";

    if (entry.locationName) {
        return entry.locationName;
    }

    const parts = [];
    if (entry.cityName) parts.push(entry.cityName);
    if (entry.countyName) parts.push(entry.countyName);
    const stateLabel = entry.stateAbbr || entry.stateName;

    if (parts.length > 0 && stateLabel) {
        return `${parts.join(", ")} (${stateLabel})`;
    }

    return parts.join(", ") || stateLabel || "";
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
