"use client";

/**
 * Status line under a schedule builder's League field for the league's team
 * list (see useLeagueTeams): a spinner while loading, a retry on failure.
 *
 * @param {{ status: string, onRetry: () => void }} props
 */
export default function LeagueTeamsNotice({ status, onRetry }) {
    if (status === "loading") {
        return (
            <div style={{ fontSize: 12, color: "#8b90a0", marginTop: 6 }}>
                <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: 6 }}></i>
                Loading teams...
            </div>
        );
    }
    if (status === "error") {
        return (
            <div role="alert" style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>
                <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 4 }}></i>
                Couldn&apos;t load this league&apos;s teams.{" "}
                <button
                    type="button"
                    onClick={onRetry}
                    style={{ background: "none", border: "none", padding: 0, color: "#FF1E00", fontWeight: 600, cursor: "pointer", textDecoration: "underline", fontSize: 12 }}
                >
                    Try again
                </button>
            </div>
        );
    }
    return null;
}
