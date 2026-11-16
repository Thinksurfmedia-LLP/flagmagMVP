"use client";

import { useMemo, useState } from "react";
import { filterAndSortTeams, leagueOptions } from "@/lib/teamPickerFilter";
import { teamLeagueSummary } from "@/lib/teamLabel";

// Searchable team list for "add this player to a team". Replaces the wall of
// ~2,400 chips: search box, Current / Past / All toggle, league filter and
// sort, then a compact list (capped — refine the search to see more).

const MAX_SHOWN = 100;
const SCOPES = [
    { value: "current", label: "Current season" },
    { value: "past", label: "Past" },
    { value: "all", label: "All" },
];
const SORTS = [
    { value: "name", label: "Name A–Z" },
    { value: "name-desc", label: "Name Z–A" },
    { value: "newest", label: "Newest season first" },
];

/**
 * @param {{
 *   teams: object[],
 *   status?: "loading" | "loaded" | "error",
 *   excludeIds?: Iterable<string>,
 *   onPick: (team: object) => void,
 *   idPrefix?: string,
 * }} props
 */
export default function TeamPicker({ teams, status = "loaded", excludeIds = [], onPick, idPrefix = "team-picker" }) {
    const [query, setQuery] = useState("");
    const [scope, setScope] = useState("current");
    const [leagueId, setLeagueId] = useState("");
    const [sort, setSort] = useState("name");

    const excluded = useMemo(() => new Set([...excludeIds].map(String)), [excludeIds]);
    const leagues = useMemo(() => leagueOptions(teams, scope), [teams, scope]);
    // A league picked under another scope may not exist in this one.
    const activeLeagueId = leagues.some((l) => l.id === leagueId) ? leagueId : "";
    const matches = useMemo(
        () => filterAndSortTeams(teams, { query, scope, leagueId: activeLeagueId, sort, excludeIds: excluded }),
        [teams, query, scope, activeLeagueId, sort, excluded]
    );
    const shown = matches.slice(0, MAX_SHOWN);

    if (status === "loading") {
        return <div className="team-picker-note"><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Loading teams...</div>;
    }
    if (status === "error") {
        return <div className="team-picker-note">Team list couldn&apos;t be loaded. Reload the page to add teams.</div>;
    }

    return (
        <div className="team-picker">
            <div className="team-picker-search">
                <i className="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                <input
                    id={`${idPrefix}-search`}
                    className="admin-form-input"
                    placeholder="Search team, league or season"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoComplete="off"
                    aria-label="Search teams"
                />
            </div>

            <div className="team-picker-controls">
                <div className="team-picker-scope" role="tablist" aria-label="Season">
                    {SCOPES.map((s) => (
                        <button
                            key={s.value}
                            type="button"
                            role="tab"
                            aria-selected={scope === s.value}
                            className={scope === s.value ? "is-active" : ""}
                            onClick={() => setScope(s.value)}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
                <select
                    className="admin-form-select"
                    value={activeLeagueId}
                    onChange={(e) => setLeagueId(e.target.value)}
                    aria-label="Filter by league"
                >
                    <option value="">All leagues</option>
                    {leagues.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
                <select className="admin-form-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort teams">
                    {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
            </div>

            <div className="team-picker-count" aria-live="polite">
                {matches.length === 0
                    ? "No teams match."
                    : matches.length > MAX_SHOWN
                        ? `Showing ${MAX_SHOWN} of ${matches.length} teams — search to narrow down`
                        : `${matches.length} team${matches.length === 1 ? "" : "s"}`}
            </div>

            <ul className="team-picker-list">
                {shown.map((t) => (
                    <li key={t._id}>
                        <button type="button" className="team-picker-row" onClick={() => onPick(t)}>
                            <span className="team-picker-row-text">
                                <span className="team-picker-row-name">{t.name}</span>
                                {/* Names repeat across leagues (e.g. two "Trojans") — show which one. */}
                                <span className="team-picker-row-meta">{teamLeagueSummary(t)}</span>
                            </span>
                            <span className="team-picker-row-add"><i className="fa-solid fa-plus"></i> Add</span>
                        </button>
                    </li>
                ))}
            </ul>
            {scope === "current" && matches.length === 0 && !query && !activeLeagueId && (
                <div className="team-picker-note">No teams in a current-season league. Choose <strong>All</strong> to see older teams.</div>
            )}
        </div>
    );
}
