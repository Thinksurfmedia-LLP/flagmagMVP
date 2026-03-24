"use client";

const warningStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    marginTop: 4,
};

export default function PlayerNumberWarning({ valid, playerNumber, label }) {
    if (!playerNumber || playerNumber.trim() === "") return null;

    if (valid === false) {
        return (
            <div style={{ ...warningStyle, backgroundColor: "rgba(255, 165, 0, 0.15)", color: "#ffa500", border: "1px solid rgba(255, 165, 0, 0.3)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                No {label || "player"} #{playerNumber} found on this team for this game
            </div>
        );
    }

    return null;
}
