"use client";

import { useEffect, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";

/**
 * League/organization picker for the public signup forms. Exposes both the
 * selected org's id (what the register APIs need) and its slug (what the
 * sibling LeaguePicker needs to fetch divisions).
 */
export default function OrganizationPicker({ value, onChange, error, defaultSlug = "" }) {
    const [organizations, setOrganizations] = useState([]);
    const [status, setStatus] = useState("loading"); // "loading" | "ready" | "error"

    useEffect(() => {
        let cancelled = false;
        fetch("/api/organizations?minimal=true")
            .then((r) => r.json())
            .then((data) => {
                if (cancelled) return;
                if (data.success) {
                    setOrganizations(data.data);
                    setStatus("ready");
                } else {
                    setStatus("error");
                }
            })
            .catch(() => { if (!cancelled) setStatus("error"); });
        return () => { cancelled = true; };
    }, []);

    // Pre-select the org the visitor arrived from (e.g. "Register Now" on
    // an organization page) once the list has loaded — only when nothing
    // has been picked yet, so it never clobbers a manual choice.
    useEffect(() => {
        if (!defaultSlug || value || status !== "ready") return;
        const match = organizations.find((o) => o.slug === defaultSlug);
        if (match) onChange(match._id, match.slug);
    }, [defaultSlug, value, status, organizations, onChange]);

    if (status === "error") {
        return (
            <div className="alert alert-danger py-2" role="alert" style={{ fontSize: 14 }}>
                Couldn&apos;t load the list of leagues. Please refresh and try again.
            </div>
        );
    }

    const options = organizations.map((org) => ({ value: org._id, label: org.name, slug: org.slug }));

    return (
        <SearchableSelect
            value={value}
            onChange={(orgId) => {
                const selected = organizations.find((o) => o._id === orgId);
                onChange(orgId, selected?.slug || "");
            }}
            options={options}
            placeholder={status === "loading" ? "Loading leagues..." : "Select a league"}
            disabled={status === "loading"}
            error={error}
            dark
        />
    );
}
