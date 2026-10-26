"use client";

import { useState } from "react";

const ACCENT = "#ff1e00";

function initials(name = "") {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
}

// Team logo with an initials fallback for teams without a logo (or a broken URL).
function TeamLogo({ name, logo, isOffense }) {
    const [failed, setFailed] = useState(false);
    const showImage = logo && !failed;
    return (
        <div
            style={{
                width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: showImage ? "#fff" : "linear-gradient(135deg, #2b303c, #3a404e)",
                border: `2px solid ${isOffense ? ACCENT : "rgba(255,255,255,0.12)"}`,
                boxShadow: isOffense ? "0 0 0 4px rgba(255,30,0,0.18)" : "none",
                overflow: "hidden",
                transition: "border-color 0.2s, box-shadow 0.2s",
            }}
        >
            {showImage ? (
                <img src={logo} alt={`${name} logo`} onError={() => setFailed(true)} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4 }} />
            ) : (
                <span style={{ color: "#e5e7eb", fontWeight: 800, fontSize: 18, letterSpacing: 0.5 }}>{initials(name)}</span>
            )}
        </div>
    );
}

function TeamSide({ team, score, isOffense, align }) {
    const isRight = align === "right";
    return (
        <div
            style={{
                display: "flex", alignItems: "center", gap: 14, minWidth: 0,
                flexDirection: isRight ? "row-reverse" : "row",
                opacity: isOffense ? 1 : 0.85,
                transition: "opacity 0.2s",
            }}
        >
            <TeamLogo name={team.name} logo={team.logo} isOffense={isOffense} />
            <div style={{ minWidth: 0, textAlign: isRight ? "right" : "left" }}>
                <div
                    title={team.name}
                    style={{ color: "#fff", fontWeight: 700, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                    {team.name}
                </div>
                <div style={{ height: 22, marginTop: 4, display: "flex", justifyContent: isRight ? "flex-end" : "flex-start" }}>
                    {isOffense && (
                        <span
                            style={{
                                display: "inline-flex", alignItems: "center", gap: 5,
                                padding: "2px 9px", borderRadius: 999,
                                background: "rgba(255,30,0,0.22)", color: "#ff8a75",
                                fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase",
                            }}
                        >
                            <i className="fa-solid fa-football" style={{ fontSize: 10 }}></i>
                            On offense
                        </span>
                    )}
                </div>
            </div>
            <div
                style={{
                    marginLeft: isRight ? 0 : "auto", marginRight: isRight ? "auto" : 0,
                    color: "#fff", fontSize: 40, fontWeight: 800, lineHeight: 1,
                    fontVariantNumeric: "tabular-nums", minWidth: 48, textAlign: "center",
                }}
            >
                {score ?? 0}
            </div>
        </div>
    );
}

/**
 * Broadcast-style score header for the Live Stats modal.
 * `activeTeam` is "A" or "B" — whichever side is currently on offense.
 */
export default function LiveScoreboard({ teamA, teamB, teamAScore, teamBScore, activeTeam, half }) {
    return (
        <div
            style={{
                position: "relative", overflow: "hidden",
                display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", alignItems: "center", gap: 20,
                padding: "18px 22px", marginBottom: 14, borderRadius: 12,
                background: "linear-gradient(135deg, #14161c 0%, #1f232d 100%)",
                boxShadow: "0 6px 18px rgba(16,18,24,0.18)",
            }}
        >
            {/* Accent bar under whichever side is on offense */}
            <div
                aria-hidden="true"
                style={{
                    position: "absolute", bottom: 0, left: 0, height: 3, width: "50%",
                    background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)`,
                    transform: activeTeam === "B" ? "translateX(100%)" : "translateX(0)",
                    transition: "transform 0.3s ease",
                }}
            />
            <TeamSide team={teamA} score={teamAScore} isOffense={activeTeam === "A"} align="left" />
            <div style={{ textAlign: "center" }}>
                <div style={{ color: "#c4c8d0", fontSize: 12, fontWeight: 800, letterSpacing: 1.5 }}>VS</div>
                {half && (
                    <div style={{ marginTop: 6, padding: "3px 10px", borderRadius: 6, background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {half} Half
                    </div>
                )}
            </div>
            <TeamSide team={teamB} score={teamBScore} isOffense={activeTeam === "B"} align="right" />
        </div>
    );
}
