"use client";

import { useEffect, useState } from "react";

const LEAGUE_TEAMS_TIMEOUT_MS = 20000;

/**
 * Teams a schedule builder can pick for one league: that league's teams plus
 * the org's placeholder (TBD/Winner/bracket-slot) teams, from the slim
 * `GET /api/teams?league=<id>&fields=basic`. Replaces loading every team in
 * the org (~1,800 for XFlag, ~30s over the Atlas link), which failed on
 * phones and left the team dropdowns — placeholders included — empty.
 *
 * @param {string} leagueId
 * @returns {{ teams: Array<object>, status: "idle"|"loading"|"loaded"|"error", retry: () => void }}
 */
export function useLeagueTeams(leagueId) {
    const [attempt, setAttempt] = useState(0);
    // Result tagged with the request it answers, so a stale one (previous
    // league or attempt) reads as "loading" without a synchronous reset.
    const [result, setResult] = useState({ key: null, teams: [], status: "idle" });
    const key = leagueId ? `${leagueId}:${attempt}` : null;

    useEffect(() => {
        if (!leagueId) return undefined;
        const requestKey = `${leagueId}:${attempt}`;
        const controller = new AbortController();
        let timedOut = false;
        const timeoutId = setTimeout(() => { timedOut = true; controller.abort(); }, LEAGUE_TEAMS_TIMEOUT_MS);
        const params = new URLSearchParams({ league: leagueId, fields: "basic" });
        fetch(`/api/teams?${params}`, { signal: controller.signal })
            .then((res) => res.json())
            .then((data) => {
                if (!data.success) throw new Error(data.error || "Failed to load teams");
                setResult({ key: requestKey, teams: data.data || [], status: "loaded" });
            })
            .catch((err) => {
                if (err?.name === "AbortError" && !timedOut) return; // league changed
                setResult({ key: requestKey, teams: [], status: "error" });
            })
            .finally(() => clearTimeout(timeoutId));
        return () => { clearTimeout(timeoutId); controller.abort(); };
    }, [leagueId, attempt]);

    const retry = () => setAttempt((n) => n + 1);
    if (!key) return { teams: [], status: "idle", retry };
    if (result.key !== key) return { teams: [], status: "loading", retry };
    return { teams: result.teams, status: result.status, retry };
}
