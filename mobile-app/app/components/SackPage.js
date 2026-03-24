"use client";

import { useState } from "react";
import PlayerNumberWarning from "./PlayerNumberWarning";
import { validatePlayerNumber, getTeamRoster, hasInvalidPlayerNumbers } from "../lib/rosterValidation";

export default function SackPage({ game, activeTeam, roster, onSave, onCancel, initialData }) {
    // For sack, the passer is on the activeTeam, and defender is on the otherTeam.
    const activeRoster = getTeamRoster(roster, activeTeam);
    const otherRoster = getTeamRoster(roster, activeTeam === "A" ? "B" : "A");
    const [passer, setPasser] = useState(initialData?.passer || "");
    const [defender, setDefender] = useState(initialData?.defender || "");
    const [safetyOption, setSafetyOption] = useState(initialData?.safety ? "Safety" : "No Safety");

    const hasInvalid = hasInvalidPlayerNumbers([
        { value: passer, roster: activeRoster },
        { value: defender, roster: otherRoster },
    ]);

    const handleSave = () => {
        onSave({
            passer,
            defender,
            safety: safetyOption === "Safety",
        });
    };

    return (
        <div className="wrapper" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: "#0b0d14", overflowY: "auto" }}>
            <div className="main-section-wrapper" style={{ alignItems: "flex-start", paddingBottom: 40 }}>
                {/* Custom Header with Back Button */}
                <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: 20 }}>
                    <div className="back-btn-area">
                        <button onClick={onCancel}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <span>Sack</span>
                    </div>
                </header>

                <div className="live-match-wrapper" style={{ paddingTop: 0 }}>
                    <div className="top" style={{ backgroundColor: "rgba(255, 30, 0, 0.1)", padding: "15px 10px", borderRadius: 15 }}>
                        <div className={`team-box ${activeTeam === "A" ? "active" : ""}`} style={{ opacity: activeTeam === "A" ? 1 : 0.4 }}>
                            <div className="image-area" style={{ width: 50, height: 50 }}>
                                <img src={game?.teamA?.logo || "/assets/images/team1.png"} alt={game?.teamA?.name} />
                            </div>
                            <h5 style={{ fontSize: 12 }}>{game?.teamA?.name}</h5>
                            <h3 style={{ color: "#ff1e00", margin: 0 }}>{game?.teamA?.score ?? 0}</h3>
                        </div>

                        <div className="team-score">
                            <div className="logo">
                                <img src="/assets/images/logo.png" alt="FlagMag" style={{ width: 40 }} />
                            </div>
                            <h6 style={{ fontSize: 10 }}>VS</h6>
                        </div>

                        <div className={`team-box ${activeTeam === "B" ? "active" : ""}`} style={{ opacity: activeTeam === "B" ? 1 : 0.4 }}>
                            <div className="image-area" style={{ width: 50, height: 50 }}>
                                <img src={game?.teamB?.logo || "/assets/images/team2.png"} alt={game?.teamB?.name} />
                            </div>
                            <h5 style={{ fontSize: 12 }}>{game?.teamB?.name}</h5>
                            <h3 style={{ color: "#ff1e00", margin: 0 }}>{game?.teamB?.score ?? 0}</h3>
                        </div>
                    </div>
                </div>

                <div className="form-area" style={{ width: "100%", padding: "10px 0" }}>
                    <div className="form-group">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Passer Number*"
                            value={passer}
                            onChange={(e) => setPasser(e.target.value)}
                        />
                        <PlayerNumberWarning valid={validatePlayerNumber(passer, activeRoster).valid} playerNumber={passer} label="passer" />
                    </div>
                    <div className="form-group">
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Defender Number*"
                            value={defender}
                            onChange={(e) => setDefender(e.target.value)}
                        />
                        <PlayerNumberWarning valid={validatePlayerNumber(defender, otherRoster).valid} playerNumber={defender} label="defender" />
                    </div>
                </div>

                <div style={{ width: "100%", padding: "15px", marginBottom: 20, display: "flex", justifyContent: "space-evenly" }}>
                    {["No Safety", "Safety"].map(opt => (
                        <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#d6d6d6", fontSize: 14 }}>
                            <input
                                type="radio"
                                name="safetyOption"
                                value={opt}
                                checked={safetyOption === opt}
                                onChange={() => setSafetyOption(opt)}
                                style={{ accentColor: "#ff1e00", width: 18, height: 18 }}
                            />
                            {opt}
                        </label>
                    ))}
                </div>

                <div className="button-area" style={{ marginTop: 30 }}>
                    <button className="btn btn-primary w-100" onClick={handleSave} disabled={hasInvalid} style={hasInvalid ? { opacity: 0.4, pointerEvents: "none" } : {}}>
                        SAVE
                    </button>
                </div>
            </div>
        </div>
    );
}
