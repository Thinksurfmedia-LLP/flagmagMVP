"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "../../lib/AuthContext";
import { apiGet, apiPut } from "../../lib/api";
import MobileHeader from "../../components/MobileHeader";
import BottomFooter from "../../components/BottomFooter";
import CompletionPage from "../../components/CompletionPage";
import FumblePage from "../../components/FumblePage";
import IncompletePassPage from "../../components/IncompletePassPage";
import InterceptionPage from "../../components/InterceptionPage";
import SackPage from "../../components/SackPage";
import RunPage from "../../components/RunPage";

function LiveGameContent({ gameId }) {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [game, setGame] = useState(null);
    const [stats, setStats] = useState([]);
    const [loadingGame, setLoadingGame] = useState(true);
    const [activeTeam, setActiveTeam] = useState("A"); // "A" or "B"
    const [timeoutsA, setTimeoutsA] = useState(0);
    const [timeoutsB, setTimeoutsB] = useState(0);
    const [round, setRound] = useState(1);
    const [half, setHalf] = useState("1st");
    const [actionLog, setActionLog] = useState([]);
    const [toast, setToast] = useState(null);
    const [showCompletionPage, setShowCompletionPage] = useState(false);
    const [showFumblePage, setShowFumblePage] = useState(false);
    const [showIncompletePassPage, setShowIncompletePassPage] = useState(false);
    const [showInterceptionPage, setShowInterceptionPage] = useState(false);
    const [showSackPage, setShowSackPage] = useState(false);
    const [showRunPage, setShowRunPage] = useState(false);
    const [editingLogIndex, setEditingLogIndex] = useState(null);
    const [roster, setRoster] = useState({ teamA: [], teamB: [] });

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

    // Fetch roster (players with jersey numbers for both teams)
    const fetchRoster = useCallback(async () => {
        try {
            const res = await apiGet(`/api/games/${gameId}/roster`);
            if (res.data) setRoster(res.data);
        } catch {
            // ignore - roster may not be available
        }
    }, [gameId]);

    useEffect(() => {
        fetchGame();
        fetchStats();
        fetchRoster();
    }, [fetchGame, fetchStats, fetchRoster]);

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
            half,
            round,
            type: actionType,
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
                setTimeoutsA(0);
                setTimeoutsB(0);
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

    const getInitialData = (type) => {
        if (editingLogIndex !== null && actionLog[editingLogIndex]?.type === type) {
            return actionLog[editingLogIndex].data;
        }
        return null;
    };

    if (showCompletionPage) {
        return (
            <CompletionPage
                game={game}
                activeTeam={activeTeam}
                roster={roster}
                initialData={getInitialData("Completion")}
                onSave={(data) => {
                    let ptsToAdd = 0;
                    if (data.points === "Touch Down") ptsToAdd = 6;
                    if (data.points === "1 Pt.") ptsToAdd = 1;
                    if (data.points === "2 Pt.") ptsToAdd = 2;

                    if (data.flagPull && data.flagPull.trim() !== "") {
                        ptsToAdd = 0;
                    }

                    const targetTeam = activeTeam;
                    let netDelta = ptsToAdd;
                    
                    if (editingLogIndex !== null) {
                        const oldLog = actionLog[editingLogIndex];
                        if (oldLog.targetTeam === targetTeam) {
                            netDelta = ptsToAdd - oldLog.ptsAdded;
                        } else {
                            updateScore(oldLog.targetTeam, -oldLog.ptsAdded);
                            netDelta = ptsToAdd;
                        }
                    }

                    if (netDelta !== 0) {
                        updateScore(targetTeam, netDelta);
                    }

                    const teamName = activeTeam === "A" ? game.teamA.name : game.teamB.name;
                    const logDesc = `Compl ${data.yards}yd P${data.passer}-R${data.receiver}${data.flagPull ? ` FP:${data.flagPull}` : ''}`;
                    const logEntry = {
                        time: new Date().toLocaleTimeString(),
                        action: logDesc,
                        team: teamName,
                        half,
                        type: "Completion",
                        activeTeam,
                        data,
                        ptsAdded: ptsToAdd,
                        targetTeam
                    };
                    
                    if (editingLogIndex !== null) {
                        const newLogs = [...actionLog];
                        newLogs[editingLogIndex] = { ...newLogs[editingLogIndex], ...logEntry };
                        setActionLog(newLogs);
                        setEditingLogIndex(null);
                        showToast("Completion updated", "success");
                    } else {
                        setActionLog(prev => [logEntry, ...prev]);
                        showToast("Completion saved", "success");
                    }
                    setShowCompletionPage(false);
                }}
                onCancel={() => {
                    setShowCompletionPage(false);
                    setEditingLogIndex(null);
                }}
            />
        );
    }

    if (showIncompletePassPage) {
        return (
            <IncompletePassPage
                game={game}
                activeTeam={activeTeam}
                roster={roster}
                initialData={getInitialData("Incompletion")}
                onSave={(data) => {
                    const teamName = activeTeam === "A" ? game.teamA.name : game.teamB.name;
                    const logDesc = `Inc P${data.passer}`;
                    const logEntry = {
                        time: new Date().toLocaleTimeString(),
                        action: logDesc,
                        team: teamName,
                        half,
                        type: "Incompletion",
                        activeTeam,
                        data,
                        ptsAdded: 0,
                        targetTeam: activeTeam
                    };
                    
                    if (editingLogIndex !== null) {
                        const newLogs = [...actionLog];
                        newLogs[editingLogIndex] = { ...newLogs[editingLogIndex], ...logEntry };
                        setActionLog(newLogs);
                        setEditingLogIndex(null);
                        showToast("Incompletion updated", "success");
                    } else {
                        setActionLog(prev => [logEntry, ...prev]);
                        showToast("Incompletion saved", "success");
                    }
                    setShowIncompletePassPage(false);
                }}
                onCancel={() => {
                    setShowIncompletePassPage(false);
                    setEditingLogIndex(null);
                }}
            />
        );
    }

    if (showFumblePage) {
        return (
            <FumblePage
                game={game}
                activeTeam={activeTeam}
                roster={roster}
                initialData={getInitialData("Fumble")}
                onSave={(data) => {
                    let ptsToAdd = 0;
                    if (data.points === "Touch Down") ptsToAdd = 6;
                    if (data.points === "2 Pt.") ptsToAdd = 2;

                    if (data.flagPull && data.flagPull.trim() !== "") {
                        ptsToAdd = 0;
                    }

                    const targetTeam = activeTeam === "A" ? "B" : "A";
                    let netDelta = ptsToAdd;

                    if (editingLogIndex !== null) {
                        const oldLog = actionLog[editingLogIndex];
                        if (oldLog.targetTeam === targetTeam) {
                            netDelta = ptsToAdd - oldLog.ptsAdded;
                        } else {
                            updateScore(oldLog.targetTeam, -oldLog.ptsAdded);
                            netDelta = ptsToAdd;
                        }
                    }

                    if (netDelta !== 0) {
                        updateScore(targetTeam, netDelta);
                    }

                    const teamName = activeTeam === "A" ? game.teamA.name : game.teamB.name;
                    const logDesc = `Fumble D${data.defender}${data.flagPull ? ` FP:${data.flagPull}` : ''}`;
                    const logEntry = {
                        time: new Date().toLocaleTimeString(),
                        action: logDesc,
                        team: teamName,
                        half,
                        type: "Fumble",
                        activeTeam,
                        data,
                        ptsAdded: ptsToAdd,
                        targetTeam
                    };
                    
                    if (editingLogIndex !== null) {
                        const newLogs = [...actionLog];
                        newLogs[editingLogIndex] = { ...newLogs[editingLogIndex], ...logEntry };
                        setActionLog(newLogs);
                        setEditingLogIndex(null);
                        showToast("Fumble updated", "success");
                    } else {
                        setActionLog(prev => [logEntry, ...prev]);
                        showToast("Fumble saved", "success");
                    }
                    setShowFumblePage(false);
                }}
                onCancel={() => {
                    setShowFumblePage(false);
                    setEditingLogIndex(null);
                }}
            />
        );
    }

    if (showInterceptionPage) {
        return (
            <InterceptionPage
                game={game}
                activeTeam={activeTeam}
                roster={roster}
                initialData={getInitialData("Interception")}
                onSave={(data) => {
                    let ptsToAdd = 0;
                    if (data.points === "Touch Down") ptsToAdd = 6;
                    if (data.points === "2 Pt.") ptsToAdd = 2;

                    if (data.flagPull && data.flagPull.trim() !== "") {
                        ptsToAdd = 0;
                    }

                    const targetTeam = activeTeam === "A" ? "B" : "A";
                    let netDelta = ptsToAdd;

                    if (editingLogIndex !== null) {
                        const oldLog = actionLog[editingLogIndex];
                        if (oldLog.targetTeam === targetTeam) {
                            netDelta = ptsToAdd - oldLog.ptsAdded;
                        } else {
                            updateScore(oldLog.targetTeam, -oldLog.ptsAdded);
                            netDelta = ptsToAdd;
                        }
                    }

                    if (netDelta !== 0) {
                        updateScore(targetTeam, netDelta);
                    }

                    const teamName = activeTeam === "A" ? game.teamA.name : game.teamB.name;
                    const logDesc = `INT P${data.passer}-D${data.defender}${data.flagPull ? ` FP:${data.flagPull}` : ''}`;
                    const logEntry = {
                        time: new Date().toLocaleTimeString(),
                        action: logDesc,
                        team: teamName,
                        half,
                        type: "Interception",
                        activeTeam,
                        data,
                        ptsAdded: ptsToAdd,
                        targetTeam
                    };
                    
                    if (editingLogIndex !== null) {
                        const newLogs = [...actionLog];
                        newLogs[editingLogIndex] = { ...newLogs[editingLogIndex], ...logEntry };
                        setActionLog(newLogs);
                        setEditingLogIndex(null);
                        showToast("Interception updated", "success");
                    } else {
                        setActionLog(prev => [logEntry, ...prev]);
                        showToast("Interception saved", "success");
                    }
                    setShowInterceptionPage(false);
                }}
                onCancel={() => {
                    setShowInterceptionPage(false);
                    setEditingLogIndex(null);
                }}
            />
        );
    }

    if (showSackPage) {
        return (
            <SackPage
                game={game}
                activeTeam={activeTeam}
                roster={roster}
                initialData={getInitialData("Sack")}
                onSave={(data) => {
                    let ptsToAdd = 0;
                    if (data.safety) ptsToAdd = 2;

                    const targetTeam = activeTeam === "A" ? "B" : "A";
                    let netDelta = ptsToAdd;

                    if (editingLogIndex !== null) {
                        const oldLog = actionLog[editingLogIndex];
                        if (oldLog.targetTeam === targetTeam) {
                            netDelta = ptsToAdd - oldLog.ptsAdded;
                        } else {
                            updateScore(oldLog.targetTeam, -oldLog.ptsAdded);
                            netDelta = ptsToAdd;
                        }
                    }

                    if (netDelta !== 0) {
                        updateScore(targetTeam, netDelta);
                    }

                    const teamName = activeTeam === "A" ? game.teamA.name : game.teamB.name;
                    const logDesc = `Sack P${data.passer}-D${data.defender}${data.safety ? ' (Safety)' : ''}`;
                    const logEntry = {
                        time: new Date().toLocaleTimeString(),
                        action: logDesc,
                        team: teamName,
                        half,
                        type: "Sack",
                        activeTeam,
                        data,
                        ptsAdded: ptsToAdd,
                        targetTeam
                    };
                    
                    if (editingLogIndex !== null) {
                        const newLogs = [...actionLog];
                        newLogs[editingLogIndex] = { ...newLogs[editingLogIndex], ...logEntry };
                        setActionLog(newLogs);
                        setEditingLogIndex(null);
                        showToast("Sack updated", "success");
                    } else {
                        setActionLog(prev => [logEntry, ...prev]);
                        showToast("Sack saved", "success");
                    }
                    setShowSackPage(false);
                }}
                onCancel={() => {
                    setShowSackPage(false);
                    setEditingLogIndex(null);
                }}
            />
        );
    }

    if (showRunPage) {
        return (
            <RunPage
                game={game}
                activeTeam={activeTeam}
                roster={roster}
                initialData={getInitialData("Run")}
                onSave={(data) => {
                    let ptsToAdd = 0;
                    if (data.points === "Touch Down") ptsToAdd = 6;
                    if (data.points === "1 Pt.") ptsToAdd = 1;
                    if (data.points === "2 Pt.") ptsToAdd = 2;

                    if (data.flagPull && data.flagPull.trim() !== "") {
                        ptsToAdd = 0;
                    }

                    const targetTeam = activeTeam;
                    let netDelta = ptsToAdd;

                    if (editingLogIndex !== null) {
                        const oldLog = actionLog[editingLogIndex];
                        if (oldLog.targetTeam === targetTeam) {
                            netDelta = ptsToAdd - oldLog.ptsAdded;
                        } else {
                            updateScore(oldLog.targetTeam, -oldLog.ptsAdded);
                            netDelta = ptsToAdd;
                        }
                    }

                    if (netDelta !== 0) {
                        updateScore(targetTeam, netDelta);
                    }

                    const teamName = activeTeam === "A" ? game.teamA.name : game.teamB.name;
                    const logDesc = `Run ${data.yards}yd R${data.rusher}${data.flagPull ? ` FP:${data.flagPull}` : ''}`;
                    const logEntry = {
                        time: new Date().toLocaleTimeString(),
                        action: logDesc,
                        team: teamName,
                        half,
                        type: "Run",
                        activeTeam,
                        data,
                        ptsAdded: ptsToAdd,
                        targetTeam
                    };
                    
                    if (editingLogIndex !== null) {
                        const newLogs = [...actionLog];
                        newLogs[editingLogIndex] = { ...newLogs[editingLogIndex], ...logEntry };
                        setActionLog(newLogs);
                        setEditingLogIndex(null);
                        showToast("Run updated", "success");
                    } else {
                        setActionLog(prev => [logEntry, ...prev]);
                        showToast("Run saved", "success");
                    }
                    setShowRunPage(false);
                }}
                onCancel={() => {
                    setShowRunPage(false);
                    setEditingLogIndex(null);
                }}
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

                    {/* Timeouts */}
                    <div className="drive-area">
                        <div className="drive-box">
                            <button onClick={() => {
                                const current = activeTeam === "A" ? timeoutsA : timeoutsB;
                                if (current > 0) {
                                    if (activeTeam === "A") setTimeoutsA(current - 1);
                                    else setTimeoutsB(current - 1);
                                }
                            }}>
                                <img src="/assets/images/spin1.png" alt="Decrease Refund" />
                            </button>
                            <h6>
                                Timeout : <span>{activeTeam === "A" ? timeoutsA : timeoutsB}</span>
                            </h6>
                            <button onClick={() => {
                                const current = activeTeam === "A" ? timeoutsA : timeoutsB;
                                if (current < 3) {
                                    if (activeTeam === "A") setTimeoutsA(current + 1);
                                    else setTimeoutsB(current + 1);
                                    
                                    const teamName = activeTeam === "A" ? game.teamA?.name : game.teamB?.name;
                                    const logEntry = {
                                        time: new Date().toLocaleTimeString(),
                                        action: "Timeout",
                                        team: teamName,
                                        half,
                                    };
                                    setActionLog(prev => [logEntry, ...prev]);
                                    showToast(`Timeout taken by ${teamName}`, "success");
                                }
                            }}>
                                <img src="/assets/images/spin2.png" alt="Increase Use" />
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
                                } else if (action.action === "Incompletion") {
                                    setShowIncompletePassPage(true);
                                } else if (action.action === "Fumble") {
                                    setShowFumblePage(true);
                                } else if (action.action === "Interception") {
                                    setShowInterceptionPage(true);
                                } else if (action.action === "Sack") {
                                    setShowSackPage(true);
                                } else if (action.action === "Run") {
                                    setShowRunPage(true);
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
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span>{log.half}</span>
                                        {['Completion', 'Incompletion', 'Interception', 'Sack', 'Run', 'Fumble'].includes(log.type) && (
                                            <button 
                                                onClick={() => {
                                                    setEditingLogIndex(i);
                                                    setActiveTeam(log.activeTeam);
                                                    if (log.type === "Completion") setShowCompletionPage(true);
                                                    if (log.type === "Incompletion") setShowIncompletePassPage(true);
                                                    if (log.type === "Interception") setShowInterceptionPage(true);
                                                    if (log.type === "Sack") setShowSackPage(true);
                                                    if (log.type === "Fumble") setShowFumblePage(true);
                                                    if (log.type === "Run") setShowRunPage(true);
                                                }}
                                                style={{ background: 'none', border: 'none', color: '#ff1e00', padding: 0, fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </span>
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
                            setTimeoutsA(0);
                            setTimeoutsB(0);
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
