"use client";

import { useEffect, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";

/**
 * Optional division/league picker, scoped to whichever organization is
 * currently selected in OrganizationPicker. Disabled and cleared whenever
 * the org changes or is empty.
 */
export default function LeaguePicker({ orgSlug, value, onChange }) {
    const [leagues, setLeagues] = useState([]);
    const [status, setStatus] = useState("idle"); // "idle" | "loading" | "ready" | "error"

    useEffect(() => {
        if (!orgSlug) {
            setLeagues([]);
            setStatus("idle");
            return;
        }
        let cancelled = false;
        setStatus("loading");
        fetch(`/api/organizations/${orgSlug}/leagues?type=active`)
            .then((r) => r.json())
            .then((data) => {
                if (cancelled) return;
                if (data.success) {
                    setLeagues(data.data);
                    setStatus("ready");
                } else {
                    setStatus("error");
                }
            })
            .catch(() => { if (!cancelled) setStatus("error"); });
        return () => { cancelled = true; };
    }, [orgSlug]);

    const options = leagues.map((league) => ({ value: league._id, label: league.name }));

    const placeholder = !orgSlug
        ? "Select a league above first"
        : status === "loading"
            ? "Loading divisions..."
            : status === "error"
                ? "Couldn't load divisions"
                : leagues.length === 0
                    ? "No divisions yet — optional"
                    : "Select a division (optional)";

    return (
        <SearchableSelect
            value={value}
            onChange={onChange}
            options={options}
            placeholder={placeholder}
            disabled={!orgSlug || status === "loading" || status === "error"}
            dark
        />
    );
}
