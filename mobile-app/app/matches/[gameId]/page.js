"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "../../lib/AuthContext";
import { apiGet, apiPut } from "../../lib/api";
import MobileHeader from "../../components/MobileHeader";
import BottomFooter from "../../components/BottomFooter";
import CompletionPage from "../../components/CompletionPage";
import InterceptionPage from "../../components/InterceptionPage";

function LiveGameContent({ gameId }) {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [game, setGame] = useState(null);
    const [stats, setStats] = useState([]);
    const [loadingGame, setLoadingGame] = useState(true);
    const [activeTeam, setActiveTeam] = useState("A"); // "A" or "B"
    const [drive, setDrive] = useState(1);
    const [round, setRound] = useState(1);
    const [half, setHalf] = useState("1st");
    const [actionLog, setActionLog] = useState([]);
    const [toast, setToast] = useState(null);
    const [showCompletionPage, setShowCompletionPage] = useState(false);
    const [showInterceptionPage, setShowInterceptionPage] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [authLoading, user, router]);

    // Fetch game data
    const fetchGame = useCallback(async () => {
        try {
            const res = await apiGet(`/api/games/${gameId}`);
            setGame(res.data);
        } catch (err) {
            console.error("Error fetching game:", err);
        } finally {
            setLoadingGame(false);
        }
    }, [gameId]);

    // Fetch stats
    const fetchStats = useCallback(async () => {
        try {
            const res = await apiGet(`/api/games/${gameId}/stats`);
            setStats(res.data || []);
        } catch {
            // ignore
        }
    }, [gameId]);

    useEffect(() => {
        fetchGame();
        fetchStats();
    }, [fetchGame, fetchStats]);

    const showToast = (message, type = "") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 2000);
    };

    // Start / change game status
    const handleStartGame = async () => {
        if (!game) return;
        try {
            if (game.status === "upcoming") {
                await apiPut(`/api/games/${gameId}`, { status: "in_progress" });
                showToast("Game started!", "success");
            } else if (game.status === "in_progress") {
                await apiPut(`/api/games/${gameId}`, { status: "completed" });
                showToast("Game completed!", "success");
            }
            fetchGame();
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    // Record a stat action
    const recordAction = async (actionType) => {
        const teamName = activeTeam === "A" ? game.teamA.name : game.teamB.name;
        const logEntry = {
            time: new Date().toLocaleTimeString(),
            action: actionType,
            team: teamName,
            drive,
            round,
        };

        setActionLog([logEntry, ...actionLog]);
        showToast(`${actionType} recorded for ${teamName}`, "success");

        // Update score for certain actions
        if (actionType === "Touchdown") {
            const scoreUpdate = {};
            if (activeTeam === "A") {
                scoreUpdate["teamA.score"] = (game.teamA.score || 0) + 6;
            } else {
                scoreUpdate["teamB.score"] = (game.teamB.score || 0) + 6;
            }
            try {
                await apiPut(`/api/games/${gameId}`, scoreUpdate);
                fetchGame();
            } catch {
                // ignore
            }
        }
    };

    // Update game score manually
    const updateScore = async (team, delta) => {
        if (!game) return;
        const field = team === "A" ? "teamA" : "teamB";
        const currentScore = game[field].score || 0;
        const newScore = Math.max(0, currentScore + delta);
        try {
            await apiPut(`/api/games/${gameId}`, {
                [`${field}.score`]: newScore,
            });
            fetchGame();
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    const handleUndo = () => {
        setActionLog((prev) => {
            if (prev.length > 0) {
                const last = prev[0];
                showToast(`Undid: ${last.action}`, "success");
                return prev.slice(1);
            }
            showToast("Nothing to undo", "error");
            return prev;
        });
    };

    const handleReset = async () => {
        if (window.confirm("Are you sure you want to reset this match to its initial state? All scores will be cleared.")) {
            try {
                await apiPut(`/api/games/${gameId}`, {
                    status: "upcoming",
                    "teamA.score": 0,
                    "teamB.score": 0
                });
                setActionLog([]);
                setHalf("1st");
                setDrive(1);
                fetchGame();
                showToast("Match reset to initial state", "success");
            } catch (err) {
                showToast(err.message, "error");
            }
        }
    };

    if (authLoading || loadingGame) {
        return (
            <div className="wrapper">
                <div className="main-section-wrapper">
                    <div className="loading-spinner" />
                </div>
            </div>
        );
    }

    if (!game) {
        return (
            <div className="wrapper">
                <div className="main-section-wrapper">
                    <div className="empty-state">
                        <h5>Game not found</h5>
                        <button className="btn btn-primary mt-3" onClick={() => router.push("/matches")}>
                            Back to Matches
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const teamAScore = game.teamA?.score ?? 0;
    const teamBScore = game.teamB?.score ?? 0;

    const statActions = [
        { icon: "/assets/images/icon-completion.png", label: "Completion", action: "Completion" },
        { icon: "/assets/images/icon-incompletion.png", label: "Incompletion", action: "Incompletion" },
        { icon: "/assets/images/icon-interception.png", label: "Interception", action: "Interception" },
        { icon: "/assets/images/icon-sack.png", label: "Sack", action: "Sack" },
        { icon: "/assets/images/icon-qb.png", label: "Fumble", action: "Fumble" },
        { icon: "/assets/images/icon-run.png", label: "Run", action: "Run" },
    ];

    if (showCompletionPage) {
        return (
            <CompletionPage
                game={game}
                activeTeam={activeTeam}
                onSave={(data) => {
                    let ptsToAdd = 0;
                    if (data.points === "Touch Down") ptsToAdd = 6;
                    if (data.points === "1 Pt.") ptsToAdd = 1;
                    if (data.points === "2 Pt.") ptsToAdd = 2;

                    if (data.flagPull && data.flagPull.trim() !== "") {
                        ptsToAdd = 0; // Flag pull cancels out the score
                    }

                    if (ptsToAdd > 0) {
                        updateScore(activeTeam, ptsToAdd);
                    }

                    const teamName = activeTeam === "A" ? game.teamA.name : game.teamB.name;
                    const logDesc = `Compl ${data.yards}yd P${data.passer}-R${data.receiver}${data.flagPull ? ` FP:${data.flagPull}` : ''}`;
                    const logEntry = {
                        time: new Date().toLocaleTimeString(),
                        action: logDesc,
                        team: teamName,
                        drive,
                    };
                    setActionLog(prev => [logEntry, ...prev]);
                    showToast("Completion saved", "success");
                    setShowCompletionPage(false);
                }}
                onCancel={() => setShowCompletionPage(false)}
            />
        );
    }

    if (showInterceptionPage) {
        return (
            <InterceptionPage
                game={game}
                activeTeam={activeTeam}
                onSave={(data) => {
                    let ptsToAdd = 0;
                    if (data.points === "Touch Down") ptsToAdd = 6;
                    if (data.points === "2 Pt.") ptsToAdd = 2;

                    if (data.flagPull && data.flagPull.trim() !== "") {
                        ptsToAdd = 0; // Flag pull cancels out the score
                    }

                    if (ptsToAdd > 0) {
                        const opponentTeam = activeTeam === "A" ? "B" : "A";
                        updateScore(opponentTeam, ptsToAdd);
                    }

                    const teamName = activeTeam === "A" ? game.teamA.name : game.teamB.name;
                    const logDesc = `INT P${data.passer}-D${data.defender}${data.flagPull ? ` FP:${data.flagPull}` : ''}`;
                    const logEntry = {
                        time: new Date().toLocaleTimeString(),
                        action: logDesc,
                        team: teamName,
                        drive,
                    };
                    setActionLog(prev => [logEntry, ...prev]);
                    showToast("Interception saved", "success");
                    setShowInterceptionPage(false);
                }}
                onCancel={() => setShowInterceptionPage(false)}
            />
        );
    }

    return (
        <div className="wrapper">
            <div className="main-section-wrapper" style={{ alignItems: "flex-start", paddingBottom: 80 }}>
                {toast && <div className={`toast-message ${toast.type}`}>{toast.message}</div>}

                <MobileHeader />

                {/* Live match score */}
                <div className="live-match-wrapper">
                    <div className="top">
                        <div
                            className={`team-box ${activeTeam === "A" ? "active" : ""}`}
                            onClick={() => setActiveTeam("A")}
                            style={{
                                cursor: "pointer",
                            }}
                        >
                            <h5>{game.teamA?.name || "Team A"}</h5>
                            <div className="image-area">
                                <img
                                    src={game.teamA?.logo || "/assets/images/team1.png"}
                                    alt={game.teamA?.name}
                                />
                            </div>
                            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 5 }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); updateScore("A", -1); }}
                                    style={{
                                        width: 28, height: 28, borderRadius: "50%",
                                        background: "rgba(255,255,255,0.1)", color: "#fff",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 16, border: "none", cursor: "pointer",
                                    }}
                                >
                                    −
                                </button>
                                <span style={{ color: "#ff1e00", fontWeight: 700, fontSize: 18 }}>
                                    {teamAScore}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); updateScore("A", 1); }}
                                    style={{
                                        width: 28, height: 28, borderRadius: "50%",
                                        background: "rgba(255,255,255,0.1)", color: "#fff",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 16, border: "none", cursor: "pointer",
                                    }}
                                >
                                    +
                                </button>
                            </div>
                            <div className="progress-area" style={{ marginTop: 8 }}>
                                <div className="progress" role="progressbar">
                                    <div
                                        className="progress-bar"
                                        style={{
                                            width: `${teamAScore + teamBScore > 0
                                                ? (teamAScore / (teamAScore + teamBScore)) * 100
                                                : 50
                                            }%`,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="team-score">
                            <div className="logo">
                                <img src="/assets/images/logo.png" alt="FlagMag" />
                            </div>
                            <h3>
                                <span>{teamAScore}</span>:<span>{teamBScore}</span>
                            </h3>
                            <h6>Score</h6>
                        </div>

                        <div
                            className={`team-box ${activeTeam === "B" ? "active" : ""}`}
                            onClick={() => setActiveTeam("B")}
                            style={{
                                cursor: "pointer",
                            }}
                        >
                            <h5>{game.teamB?.name || "Team B"}</h5>
                            <div className="image-area">
                                <img
                                    src={game.teamB?.logo || "/assets/images/team2.png"}
                                    alt={game.teamB?.name}
                                />
                            </div>
                            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 5 }}>
                                <button
                                    onClick={(e) => { e.stopPropagation(); updateScore("B", -1); }}
                                    style={{
                                        width: 28, height: 28, borderRadius: "50%",
                                        background: "rgba(255,255,255,0.1)", color: "#fff",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 16, border: "none", cursor: "pointer",
                                    }}
                                >
                                    −
                                </button>
                                <span style={{ color: "#ff1e00", fontWeight: 700, fontSize: 18 }}>
                                    {teamBScore}
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); updateScore("B", 1); }}
                                    style={{
                                        width: 28, height: 28, borderRadius: "50%",
                                        background: "rgba(255,255,255,0.1)", color: "#fff",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 16, border: "none", cursor: "pointer",
                                    }}
                                >
                                    +
                                </button>
                            </div>
                            <div className="progress-area" style={{ marginTop: 8 }}>
                                <div className="progress" role="progressbar">
                                    <div
                                        className="progress-bar"
                                        style={{
                                            width: `${teamAScore + teamBScore > 0
                                                ? (teamBScore / (teamAScore + teamBScore)) * 100
                                                : 50
                                            }%`,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Game info */}
                    <div className="info-text">
                        <div className="text">
                            Half : <span>{half}</span>
                        </div>
                        <div className="text">
                            Status : <span className={`status-badge ${game.status}`}>{game.status}</span>
                        </div>
                    </div>

                    {/* Drive counter */}
                    <div className="drive-area">
                        <div className="drive-box">
                            <button onClick={() => setDrive(Math.max(1, drive - 1))}>
                                <img src="/assets/images/spin1.png" alt="Decrease" />
                            </button>
                            <h6>
                                Drive : <span>{drive}</span>
                            </h6>
                            <button onClick={() => setDrive(drive + 1)}>
                                <img src="/assets/images/spin2.png" alt="Increase" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stat action buttons */}
                <div className="managment-box-area">
                    {statActions.map((action) => (
                        <div
                            key={action.action}
                            className="control-box"
                            onClick={() => {
                                if (action.action === "Completion") {
                                    setShowCompletionPage(true);
                                } else if (action.action === "Interception") {
                                    setShowInterceptionPage(true);
                                } else {
                                    recordAction(action.action);
                                }
                            }}
                        >
                            <img src={action.icon} alt={action.label} />
                            <h6>{action.label}</h6>
                        </div>
                    ))}
                </div>

                {/* Recent actions log */}
                {actionLog.length > 0 && (
                    <div style={{ width: "100%", marginTop: 15 }}>
                        <h6 style={{ fontSize: 14, marginBottom: 8, color: "#b0b0b0", fontFamily: "'DM Sans', sans-serif" }}>
                            Recent Actions
                        </h6>
                        <div style={{ maxHeight: 150, overflowY: "auto" }}>
                            {actionLog.slice(0, 10).map((log, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        padding: "6px 10px",
                                        fontSize: 12,
                                        color: "#b0b0b0",
                                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                                    }}
                                >
                                    <span>
                                        <strong style={{ color: "#fff" }}>{log.action}</strong> — {log.team}
                                    </span>
                                    <span>D{log.drive}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <BottomFooter
                    onUndo={handleUndo}
                    onStart={handleStartGame}
                    onConfirm={async () => {
                        if (half === "1st") {
                            setHalf("2nd");
                            showToast("Switched to 2nd Half", "success");
                        } else if (half === "2nd") {
                            try {
                                await apiPut(`/api/games/${gameId}`, { status: "completed" });
                                showToast("Game completed!", "success");
                                fetchGame();
                            } catch (err) {
                                showToast(err.message, "error");
                            }
                        }
                    }}
                    onReset={handleReset}
                />
            </div>
        </div>
    );
}

function LiveGameWrapper({ params }) {
    const { gameId } = use(params);
    return (
        <AuthProvider>
            <LiveGameContent gameId={gameId} />
        </AuthProvider>
    );
}

export default LiveGameWrapper;
