"use client";

// Timeout UI for the Live Stats modal. Each team gets MAX_TIMEOUTS_PER_HALF
// per half; taking one pauses stat recording until "Resume Game" is pressed.

export const MAX_TIMEOUTS_PER_HALF = 3;

// Spelled-out count ("2 left") rather than icons, so it can't be read as "2 used".
function TimeoutsLeftBadge({ left }) {
    const none = left <= 0;
    return (
        <span
            style={{
                padding: "1px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                background: none ? "#e5e7eb" : "#fff",
                color: none ? "#6b7280" : "#9a3412",
                border: `1px solid ${none ? "#d1d5db" : "rgba(255,107,26,0.45)"}`,
            }}
        >
            {none ? "None left" : `${left} left`}
        </span>
    );
}

/**
 * One "call timeout" button per team, each showing how many timeouts that
 * team has left this half. `teams` is [{ key: "A" | "B", name, used }].
 */
export function TimeoutControls({ teams, disabled, onTimeout }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#1f2330", marginRight: 4 }}>
                Timeouts
            </span>
            {teams.map((team) => {
                const left = Math.max(0, MAX_TIMEOUTS_PER_HALF - team.used);
                const blocked = disabled || left <= 0;
                const usedText = `${team.used} of ${MAX_TIMEOUTS_PER_HALF} used this half`;
                return (
                    <button
                        key={team.key}
                        type="button"
                        onClick={() => onTimeout(team.key)}
                        disabled={blocked}
                        title={left <= 0 ? `${team.name} has no timeouts left this half` : `Call a timeout for ${team.name} (${usedText})`}
                        aria-label={`Call timeout for ${team.name}. ${left} of ${MAX_TIMEOUTS_PER_HALF} left this half.`}
                        style={{
                            display: "inline-flex", alignItems: "center", gap: 8, maxWidth: 280,
                            padding: "4px 6px 4px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                            background: blocked ? "#f3f4f6" : "rgba(255,107,26,0.12)",
                            color: blocked ? "#6b7280" : "#9a3412",
                            border: `1px solid ${blocked ? "#d1d5db" : "rgba(255,107,26,0.5)"}`,
                            cursor: blocked ? "not-allowed" : "pointer",
                            transition: "background 0.15s",
                        }}
                    >
                        <i className="fa-solid fa-hand" style={{ fontSize: 11 }}></i>
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{team.name}</span>
                        <TimeoutsLeftBadge left={left} />
                    </button>
                );
            })}
        </div>
    );
}

// Shown above the (locked) stat buttons while the game is paused.
export function TimeoutPausedBanner({ teamName, used }) {
    return (
        <div
            role="status"
            style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 14px", marginBottom: 12, borderRadius: 8,
                background: "#fff7ed", border: "1px solid #fed7aa", color: "#9a3412",
            }}
        >
            <i className="fa-solid fa-circle-pause" style={{ fontSize: 18, color: "#ff6b1a" }}></i>
            <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                <strong>Timeout{teamName ? ` — ${teamName}` : ""}</strong>
                {teamName && <span style={{ color: "#c2410c" }}> ({MAX_TIMEOUTS_PER_HALF - used} of {MAX_TIMEOUTS_PER_HALF} left this half)</span>}
                <div style={{ color: "#b45309" }}>Stat recording is paused. Press <strong>Resume Game</strong> below to continue.</div>
            </div>
        </div>
    );
}

export function ResumeGameButton({ onResume }) {
    return (
        <button
            type="button"
            onClick={onResume}
            className="admin-btn"
            style={{ background: "#16a34a", borderColor: "#16a34a", color: "#fff", boxShadow: "0 4px 14px rgba(22,163,74,0.3)" }}
        >
            <i className="fa-solid fa-play"></i> Resume Game
        </button>
    );
}
