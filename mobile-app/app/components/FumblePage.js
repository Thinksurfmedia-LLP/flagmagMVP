import { useState } from "react";

export default function FumblePage({ game, activeTeam, onSave, onCancel, initialData }) {
    // For fumble, the defender recovering is on the otherTeam.
    const [defender, setDefender] = useState(initialData?.defender || "");
    const [points, setPoints] = useState(initialData?.points || null); // "Touch Down", "2 Pt.", "None"
    const [flagPull, setFlagPull] = useState(initialData?.flagPull || "");

    const handleSave = () => {
        if (!defender) {
            alert("Defender Number is required");
            return;
        }

        onSave({
            defender,
            points,
            flagPull: points !== null ? "" : flagPull,
        });
    };

    const isFlagPullDisabled = points !== null;

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
                        <span>Fumble</span>
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
                            placeholder="Defender Number*"
                            value={defender}
                            onChange={(e) => setDefender(e.target.value)}
                        />
                    </div>
                </div>

                <div style={{ width: "100%", backgroundColor: "rgba(255, 30, 0, 0.15)", borderRadius: 15, padding: "15px", marginBottom: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 15 }}>
                        <h6 style={{ margin: 0, fontSize: 14 }}>Points</h6>
                        <button onClick={() => setPoints(null)} style={{ color: "#ff1e00", fontSize: 12, fontWeight: 600 }}>Reset</button>
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15 }}>
                        {["Touch Down", "2 Pt.", "None"].map(pt => (
                            <label key={pt} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#d6d6d6", fontSize: 14 }}>
                                <input
                                    type="radio"
                                    name="points"
                                    value={pt}
                                    checked={points === pt}
                                    onChange={() => setPoints(pt)}
                                    style={{ accentColor: "#ff1e00", width: 18, height: 18 }}
                                />
                                {pt}
                            </label>
                        ))}
                    </div>
                </div>

                <div style={{ width: "100%", backgroundColor: "rgba(255, 255, 255, 0.05)", borderRadius: 15, padding: "15px", opacity: points !== null ? 0.4 : 1, transition: "opacity 0.3s" }}>
                    <h6 style={{ margin: 0, fontSize: 14, marginBottom: 15 }}>Flag Pull</h6>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Flag Pull*"
                            value={flagPull}
                            onChange={(e) => setFlagPull(e.target.value)}
                            disabled={points !== null}
                            style={{ backgroundColor: points !== null ? "rgba(0,0,0,0.2)" : "#2b2726" }}
                        />
                    </div>
                </div>

                <div className="button-area" style={{ marginTop: 30 }}>
                    <button className="btn btn-primary w-100" onClick={handleSave}>
                        SAVE
                    </button>
                </div>
            </div>
        </div>
    );
}
