"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "../../lib/AuthContext";
import { apiGet, apiPost, apiPut } from "../../lib/api";
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
    const [firstHalfCompleted, setFirstHalfCompleted] = useState(false);
    const [viewingHalf, setViewingHalf] = useState("1st"); // which half tab is selected for viewing
    const [showHalfConfirm, setShowHalfConfirm] = useState(false);
    const [firstHalfSnapshot, setFirstHalfSnapshot] = useState(null); // { timeoutsA, timeoutsB, scoreA, scoreB, actionLog }
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);
    const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [showNavLockConfirm, setShowNavLockConfirm] = useState(false);

    // A game being actively recorded must not be abandoned via refresh/back/nav.
    // The statistician has to use Cancel Game / Forfeit / End Game instead.
    const isLive = !!game && game.status === "in_progress";

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [authLoading, user, router]);

    // Block browser refresh / tab close / typed-URL navigation while recording.
    useEffect(() => {
        if (!isLive) return undefined;
        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = "";
            return "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isLive]);

    // Block the browser/gesture back button while recording by trapping history.
    useEffect(() => {
        if (!isLive) return undefined;
        window.history.pushState({ gameLock: true }, "", window.location.href);
        const handlePopState = () => {
            // Re-trap immediately so the back navigation never actually completes.
            window.history.pushState({ gameLock: true }, "", window.location.href);
            setShowNavLockConfirm(true);
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [isLive]);

    // Disable mobile pull-to-refresh while recording. Safari largely ignores
    // beforeunload confirmations for the pull-down-to-reload gesture, so the
    // CSS hint alone isn't enough there — actively swallow the touch gesture
    // that triggers it before Safari's native reload UI ever kicks in.
    useEffect(() => {
        if (!isLive) return undefined;
        const previousOverscroll = document.body.style.overscrollBehaviorY;
        document.body.style.overscrollBehaviorY = "contain";

        let touchStartY = 0;
        const handleTouchStart = (e) => {
            touchStartY = e.touches[0].clientY;
        };
        const handleTouchMove = (e) => {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const pullingDownFromTop = scrollTop <= 0 && e.touches[0].clientY > touchStartY;
            if (pullingDownFromTop) {
                e.preventDefault();
            }
        };
        document.addEventListener("touchstart", handleTouchStart, { passive: true });
        document.addEventListener("touchmove", handleTouchMove, { passive: false });

        return () => {
            document.body.style.overscrollBehaviorY = previousOverscroll;
            document.removeEventListener("touchstart", handleTouchStart);
            document.removeEventListener("touchmove", handleTouchMove);
        };
    }, [isLive]);

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

    // Load persisted plays into action log on page load / refresh — runs once when game first loads
    useEffect(() => {
        if (!game) return;
        const playTypeMap = {
            completion: "Completion",
            incomplete: "Incompletion",
            interception: "Interception",
            sack: "Sack",
            fumble: "Fumble",
            run: "Run",
            timeout: "Timeout",
        };
        const toLog = (play) => ({
            time: new Date(play.createdAt).toLocaleTimeString(),
            action: playTypeMap[play.type] || play.type,
            team: play.teamName || "",
            half: play.half || "1st",
            type: playTypeMap[play.type] || play.type,
            activeTeam: play.activeTeam || "A",
            playId: play._id?.toString(),
            ptsAdded: play.ptsAdded || 0,
            targetTeam: play.targetTeam || play.activeTeam || "A",
            data: {
                passer: play.passer || "",
                receiver: play.receiver || "",
                rusher: play.rusher || "",
                defender: play.defender || "",
                flagPull: play.flagPull || "",
                yards: play.yards || 0,
                points: play.points || "",
                safety: play.safety || false,
            },
        });
        const loadPlays = async () => {
            try {
                const res = await apiGet(`/api/games/${gameId}/plays`);
                if (!res.data || res.data.length === 0) return;
                const allPlays = res.data; // oldest-first (API sorts createdAt: 1)
                const firstHalfPlays = allPlays.filter(p => (p.half || "1st") === "1st");
                const secondHalfPlays = allPlays.filter(p => p.half === "2nd");
                const isInSecondHalf = game.firstHalfCompleted || secondHalfPlays.length > 0;
                if (isInSecondHalf) {
                    const h1TimeoutsA = firstHalfPlays.filter(p => p.type === "timeout" && p.activeTeam === "A").length;
                    const h1TimeoutsB = firstHalfPlays.filter(p => p.type === "timeout" && p.activeTeam === "B").length;
                    setFirstHalfSnapshot({
                        timeoutsA: h1TimeoutsA,
                        timeoutsB: h1TimeoutsB,
                        scoreA: game.halfOneScoreA ?? 0,
                        scoreB: game.halfOneScoreB ?? 0,
                        actionLog: firstHalfPlays.map(toLog).reverse(),
                    });
                    setFirstHalfCompleted(true);
                    setHalf("2nd");
                    setViewingHalf("2nd");
                    const h2TimeoutsA = secondHalfPlays.filter(p => p.type === "timeout" && p.activeTeam === "A").length;
                    const h2TimeoutsB = secondHalfPlays.filter(p => p.type === "timeout" && p.activeTeam === "B").length;
                    setTimeoutsA(h2TimeoutsA);
                    setTimeoutsB(h2TimeoutsB);
                    setActionLog(secondHalfPlays.map(toLog).reverse());
                } else {
                    const h1TimeoutsA = firstHalfPlays.filter(p => p.type === "timeout" && p.activeTeam === "A").length;
                    const h1TimeoutsB = firstHalfPlays.filter(p => p.type === "timeout" && p.activeTeam === "B").length;
                    setTimeoutsA(h1TimeoutsA);
                    setTimeoutsB(h1TimeoutsB);
                    setActionLog(allPlays.map(toLog).reverse());
                }
            } catch { /* ignore */ }
        };
        loadPlays();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game?._id, gameId]);

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
        if (window.confirm("Are you sure you want to reset this game to its initial state? All scores will be cleared.")) {
            try {
                await apiPost(`/api/games/${gameId}/reset`);
                setActionLog([]);
                setHalf("1st");
                setTimeoutsA(0);
                setTimeoutsB(0);
                showToast("Game reset to initial state", "success");
                router.push("/matches");
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
                            Back to Games
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const teamAScore = game.teamA?.score ?? 0;
    const teamBScore = game.teamB?.score ?? 0;
    const isGameFinished = game.status === "completed" || game.status === "cancelled";
    const isViewOnly = isGameFinished || (viewingHalf === "1st" && firstHalfCompleted);
    const displayTimeoutsA = (viewingHalf === "1st" && firstHalfCompleted && firstHalfSnapshot) ? firstHalfSnapshot.timeoutsA : timeoutsA;
    const displayTimeoutsB = (viewingHalf === "1st" && firstHalfCompleted && firstHalfSnapshot) ? firstHalfSnapshot.timeoutsB : timeoutsB;
    const displayActionLog = (viewingHalf === "1st" && firstHalfCompleted && firstHalfSnapshot) ? firstHalfSnapshot.actionLog : actionLog;
    const displayScoreA = (viewingHalf === "1st" && firstHalfCompleted && firstHalfSnapshot) ? firstHalfSnapshot.scoreA : teamAScore;
    const displayScoreB = (viewingHalf === "1st" && firstHalfCompleted && firstHalfSnapshot) ? firstHalfSnapshot.scoreB : teamBScore;

    // Persist a play to the database
    const persistPlay = async (playType, logEntry, playData) => {
        try {
            const teamName = logEntry.team;
            const res = await apiPost(`/api/games/${gameId}/plays`, {
                type: playType,
                activeTeam: logEntry.activeTeam,
                teamName,
                half: logEntry.half,
                passer: playData.passer || "",
                receiver: playData.receiver || "",
                rusher: playData.rusher || "",
                defender: playData.defender || "",
                flagPull: playData.flagPull || "",
                yards: Number(playData.yards) || 0,
                points: playData.points || "",
                safety: Boolean(playData.safety),
                ptsAdded: logEntry.ptsAdded,
                targetTeam: logEntry.targetTeam,
            });
            return res.data?._id?.toString() || null;
        } catch (err) {
            console.error("Failed to persist play:", err);
            return null;
        }
    };

    const updatePlay = async (playId, playType, logEntry, playData) => {
        if (!playId) return;
        try {
            await apiPut(`/api/games/${gameId}/plays?playId=${playId}`, {
                type: playType,
                activeTeam: logEntry.activeTeam,
                teamName: logEntry.team,
                half: logEntry.half,
                passer: playData.passer || "",
                receiver: playData.receiver || "",
                rusher: playData.rusher || "",
                defender: playData.defender || "",
                flagPull: playData.flagPull || "",
                yards: Number(playData.yards) || 0,
                points: playData.points || "",
                safety: Boolean(playData.safety),
                ptsAdded: logEntry.ptsAdded,
                targetTeam: logEntry.targetTeam,
            });
        } catch (err) {
            console.error("Failed to update play:", err);
        }
    };

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
                onTeamChange={(team) => setActiveTeam(team)}
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
                    const oldLog = editingLogIndex !== null ? actionLog[editingLogIndex] : null;

                    if (oldLog) {
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
                        updatePlay(oldLog.playId, "completion", logEntry, data);
                        setEditingLogIndex(null);
                        showToast("Completion updated", "success");
                    } else {
                        setActionLog(prev => [logEntry, ...prev]);
                        persistPlay("completion", logEntry, data).then(playId => {
                            if (playId) setActionLog(prev => {
                                const next = [...prev];
                                const idx = next.findIndex(l => !l.playId && l.type === "Completion" && l.time === logEntry.time);
                                if (idx !== -1) next[idx] = { ...next[idx], playId };
                                return next;
                            });
                        });
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
                onTeamChange={(team) => setActiveTeam(team)}
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
                        const oldLog = actionLog[editingLogIndex];
                        const newLogs = [...actionLog];
                        newLogs[editingLogIndex] = { ...newLogs[editingLogIndex], ...logEntry };
                        setActionLog(newLogs);
                        updatePlay(oldLog.playId, "incomplete", logEntry, data);
                        setEditingLogIndex(null);
                        showToast("Incompletion updated", "success");
                    } else {
                        setActionLog(prev => [logEntry, ...prev]);
                        persistPlay("incomplete", logEntry, data).then(playId => {
                            if (playId) setActionLog(prev => {
                                const next = [...prev];
                                const idx = next.findIndex(l => !l.playId && l.type === "Incompletion" && l.time === logEntry.time);
                                if (idx !== -1) next[idx] = { ...next[idx], playId };
                                return next;
                            });
                        });
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
                onTeamChange={(team) => setActiveTeam(team)}
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
                    const oldLog = editingLogIndex !== null ? actionLog[editingLogIndex] : null;

                    if (oldLog) {
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
                        updatePlay(oldLog.playId, "fumble", logEntry, data);
                        setEditingLogIndex(null);
                        showToast("Fumble updated", "success");
                    } else {
                        setActionLog(prev => [logEntry, ...prev]);
                        persistPlay("fumble", logEntry, data).then(playId => {
                            if (playId) setActionLog(prev => {
                                const next = [...prev];
                                const idx = next.findIndex(l => !l.playId && l.type === "Fumble" && l.time === logEntry.time);
                                if (idx !== -1) next[idx] = { ...next[idx], playId };
                                return next;
                            });
                        });
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
                onTeamChange={(team) => setActiveTeam(team)}
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
                    const oldLog = editingLogIndex !== null ? actionLog[editingLogIndex] : null;

                    if (oldLog) {
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
                        updatePlay(oldLog.playId, "interception", logEntry, data);
                        setEditingLogIndex(null);
                        showToast("Interception updated", "success");
                    } else {
                        setActionLog(prev => [logEntry, ...prev]);
                        persistPlay("interception", logEntry, data).then(playId => {
                            if (playId) setActionLog(prev => {
                                const next = [...prev];
                                const idx = next.findIndex(l => !l.playId && l.type === "Interception" && l.time === logEntry.time);
                                if (idx !== -1) next[idx] = { ...next[idx], playId };
                                return next;
                            });
                        });
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
                onTeamChange={(team) => setActiveTeam(team)}
                initialData={getInitialData("Sack")}
                onSave={(data) => {
                    let ptsToAdd = 0;
                    if (data.safety) ptsToAdd = 2;

                    const targetTeam = activeTeam === "A" ? "B" : "A";
                    let netDelta = ptsToAdd;
                    const oldLog = editingLogIndex !== null ? actionLog[editingLogIndex] : null;

                    if (oldLog) {
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
                        updatePlay(oldLog.playId, "sack", logEntry, data);
                        setEditingLogIndex(null);
                        showToast("Sack updated", "success");
                    } else {
                        setActionLog(prev => [logEntry, ...prev]);
                        persistPlay("sack", logEntry, data).then(playId => {
                            if (playId) setActionLog(prev => {
                                const next = [...prev];
                                const idx = next.findIndex(l => !l.playId && l.type === "Sack" && l.time === logEntry.time);
                                if (idx !== -1) next[idx] = { ...next[idx], playId };
                                return next;
                            });
                        });
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
                onTeamChange={(team) => setActiveTeam(team)}
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
                    const oldLog = editingLogIndex !== null ? actionLog[editingLogIndex] : null;

                    if (oldLog) {
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
                        updatePlay(oldLog.playId, "run", logEntry, data);
                        setEditingLogIndex(null);
                        showToast("Run updated", "success");
                    } else {
                        setActionLog(prev => [logEntry, ...prev]);
                        persistPlay("run", logEntry, data).then(playId => {
                            if (playId) setActionLog(prev => {
                                const next = [...prev];
                                const idx = next.findIndex(l => !l.playId && l.type === "Run" && l.time === logEntry.time);
                                if (idx !== -1) next[idx] = { ...next[idx], playId };
                                return next;
                            });
                        });
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

                <MobileHeader
                    navLocked={isLive}
                    onNavLockedAttempt={() => setShowNavLockConfirm(true)}
                />

                {/* Navigation locked while recording a live game */}
                {showNavLockConfirm && (
                    <div className="confirm-overlay" onClick={() => setShowNavLockConfirm(false)}>
                        <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
                            <h4>Game In Progress</h4>
                            <p>You can&apos;t leave this page while recording a live game.</p>
                            <p className="confirm-detail">
                                Use Cancel Game, Forfeit, or End Game below to exit properly.
                            </p>
                            <div className="confirm-actions">
                                <button className="btn btn-primary" onClick={() => setShowNavLockConfirm(false)}>
                                    Got It
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Live match score */}
                <div className="live-match-wrapper">
                    <div className="top">
                        {/* Team A column — selector box + timeout below it */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 10 }}>
                            <div
                                className={`team-box ${activeTeam === "A" ? "active" : ""}`}
                                onClick={() => {
                                    if (isPaused) { showToast("Resume the game first", "error"); return; }
                                    setActiveTeam("A");
                                }}
                                style={{ cursor: "pointer", width: "100%" }}
                            >
                                <h5>{game.teamA?.name || "Team A"}</h5>
                                <div className="image-area">
                                    <img
                                        src={game.teamA?.logo || "/assets/images/team-placeholder.svg"}
                                        alt={game.teamA?.name}
                                    />
                                </div>
                            </div>
                            <span style={{ color: "#ccc", fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>TO: {displayTimeoutsA}/3</span>
                            {!isViewOnly && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isPaused) { showToast("Resume the game first", "error"); return; }
                                        if (timeoutsA < 3) {
                                            setTimeoutsA(timeoutsA + 1);
                                            setIsPaused(true);
                                            const logEntry = {
                                                time: new Date().toLocaleTimeString(),
                                                action: "Timeout",
                                                team: game.teamA?.name,
                                                half,
                                                type: "Timeout",
                                                activeTeam: "A",
                                                data: {},
                                            };
                                            setActionLog(prev => [logEntry, ...prev]);
                                            apiPost(`/api/games/${gameId}/plays`, {
                                                type: "timeout",
                                                activeTeam: "A",
                                                teamName: game.teamA?.name,
                                                half,
                                            }).catch(() => {});
                                            showToast(`Timeout taken by ${game.teamA?.name} (${timeoutsA + 1}/3 this half)`, "success");
                                        } else {
                                            showToast(`${game.teamA?.name} has no timeouts left this half`, "error");
                                        }
                                    }}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: 20,
                                        background: (isPaused || timeoutsA >= 3) ? "rgba(255,255,255,0.05)" : "rgba(255,100,30,0.25)",
                                        color: (isPaused || timeoutsA >= 3) ? "#555" : "#ff8040",
                                        border: `1.5px solid ${(isPaused || timeoutsA >= 3) ? "rgba(255,255,255,0.08)" : "rgba(255,120,40,0.5)"}`,
                                        fontSize: 12, fontWeight: 700, letterSpacing: 1,
                                        cursor: (isPaused || timeoutsA >= 3) ? "not-allowed" : "pointer",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    TIMEOUT
                                </button>
                            )}
                        </div>

                        <div className="team-score">
                            <h3>
                                <span>{displayScoreA}</span>:<span>{displayScoreB}</span>
                            </h3>
                            <h6>Score</h6>
                        </div>

                        {/* Team B column — selector box + timeout below it */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, gap: 10 }}>
                            <div
                                className={`team-box ${activeTeam === "B" ? "active" : ""}`}
                                onClick={() => {
                                    if (isPaused) { showToast("Resume the game first", "error"); return; }
                                    setActiveTeam("B");
                                }}
                                style={{ cursor: "pointer", width: "100%" }}
                            >
                                <h5>{game.teamB?.name || "Team B"}</h5>
                                <div className="image-area">
                                    <img
                                        src={game.teamB?.logo || "/assets/images/team-placeholder.svg"}
                                        alt={game.teamB?.name}
                                    />
                                </div>
                            </div>
                            <span style={{ color: "#ccc", fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>TO: {displayTimeoutsB}/3</span>
                            {!isViewOnly && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (isPaused) { showToast("Resume the game first", "error"); return; }
                                        if (timeoutsB < 3) {
                                            setTimeoutsB(timeoutsB + 1);
                                            setIsPaused(true);
                                            const logEntry = {
                                                time: new Date().toLocaleTimeString(),
                                                action: "Timeout",
                                                team: game.teamB?.name,
                                                half,
                                                type: "Timeout",
                                                activeTeam: "B",
                                                data: {},
                                            };
                                            setActionLog(prev => [logEntry, ...prev]);
                                            apiPost(`/api/games/${gameId}/plays`, {
                                                type: "timeout",
                                                activeTeam: "B",
                                                teamName: game.teamB?.name,
                                                half,
                                            }).catch(() => {});
                                            showToast(`Timeout taken by ${game.teamB?.name} (${timeoutsB + 1}/3 this half)`, "success");
                                        } else {
                                            showToast(`${game.teamB?.name} has no timeouts left this half`, "error");
                                        }
                                    }}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: 20,
                                        background: (isPaused || timeoutsB >= 3) ? "rgba(255,255,255,0.05)" : "rgba(255,100,30,0.25)",
                                        color: (isPaused || timeoutsB >= 3) ? "#555" : "#ff8040",
                                        border: `1.5px solid ${(isPaused || timeoutsB >= 3) ? "rgba(255,255,255,0.08)" : "rgba(255,120,40,0.5)"}`,
                                        fontSize: 12, fontWeight: 700, letterSpacing: 1,
                                        cursor: (isPaused || timeoutsB >= 3) ? "not-allowed" : "pointer",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    TIMEOUT
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Game info */}
                    <div className="info-text">
                        <div className="text">
                            <span className={`status-badge ${game.status}`}>{game.status}</span>
                        </div>
                    </div>


                </div>

                {/* Half toggler */}
                <div style={{ display: "flex", alignItems: "center", gap: 0, alignSelf: "flex-start", margin: "12px 0 8px 0" }}>
                    <button
                        onClick={() => {
                            setViewingHalf("1st");
                        }}
                        style={{
                            padding: "6px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            border: "none",
                            borderRadius: "6px 0 0 6px",
                            cursor: "pointer",
                            background: viewingHalf === "1st" ? "#ff1e00" : "rgba(255,255,255,0.1)",
                            color: viewingHalf === "1st" ? "#fff" : "#aaa",
                        }}
                    >
                        1st Half
                    </button>
                    <button
                        onClick={() => {
                            if (isGameFinished || firstHalfCompleted) {
                                setViewingHalf("2nd");
                            } else {
                                setShowHalfConfirm(true);
                            }
                        }}
                        style={{
                            padding: "6px 16px",
                            fontSize: 13,
                            fontWeight: 600,
                            border: "none",
                            borderRadius: "0 6px 6px 0",
                            cursor: "pointer",
                            background: viewingHalf === "2nd" ? "#ff1e00" : "rgba(255,255,255,0.1)",
                            color: viewingHalf === "2nd" ? "#fff" : "#aaa",
                        }}
                    >
                        2nd Half
                    </button>
                </div>

                {/* Half change confirmation */}
                {showHalfConfirm && (
                    <div className="confirm-overlay" onClick={() => setShowHalfConfirm(false)}>
                        <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
                            <h4>End 1st Half?</h4>
                            <p>Are you sure you want to mark the 1st half as complete and move to the 2nd half?</p>
                            <p style={{ color: "#999", fontSize: 12 }}>The 1st half stats will become view-only.</p>
                            <div className="confirm-actions">
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setShowHalfConfirm(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="btn btn-primary"
                                    onClick={async () => {
                                        setFirstHalfSnapshot({
                                            timeoutsA,
                                            timeoutsB,
                                            scoreA: teamAScore,
                                            scoreB: teamBScore,
                                            actionLog: [...actionLog],
                                        });
                                        setFirstHalfCompleted(true);
                                        setHalf("2nd");
                                        setViewingHalf("2nd");
                                        setTimeoutsA(0);
                                        setTimeoutsB(0);
                                        setActionLog([]);
                                        setShowHalfConfirm(false);
                                        showToast("1st half completed. Now in 2nd half.", "success");
                                        apiPut(`/api/games/${gameId}`, {
                                            firstHalfCompleted: true,
                                            currentHalf: "2nd",
                                            halfOneScoreA: teamAScore,
                                            halfOneScoreB: teamBScore,
                                        }).catch(() => {});
                                    }}
                                >
                                    Yes, Start 2nd Half
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Stat action buttons */}
                {!isGameFinished && (
                <div className="managment-box-area" style={(isViewOnly || isPaused) ? { opacity: 0.4, pointerEvents: "none" } : {}}>
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
                )}

                {/* Recent actions log */}
                {displayActionLog.length > 0 && (
                    <div style={{ width: "100%", marginTop: 15 }}>
                        <h6 style={{ fontSize: 14, marginBottom: 8, color: "#b0b0b0", fontFamily: "'DM Sans', sans-serif" }}>
                            Recent Actions ({displayActionLog.length}){(firstHalfCompleted || isGameFinished) ? ` — ${viewingHalf} Half` : ""}
                        </h6>
                        <div style={{ maxHeight: 220, overflowY: "auto" }}>
                            {displayActionLog.map((log, i) => {
                                const d = log.data || {};
                                const typeColors = {
                                    Completion: { bg: "rgba(34,197,94,0.15)", color: "#22c55e" },
                                    Incompletion: { bg: "rgba(156,163,175,0.15)", color: "#9ca3af" },
                                    Interception: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
                                    Sack: { bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
                                    Fumble: { bg: "rgba(239,68,68,0.15)", color: "#ef4444" },
                                    Run: { bg: "rgba(59,130,246,0.15)", color: "#3b82f6" },
                                    Timeout: { bg: "rgba(168,85,247,0.15)", color: "#a855f7" },
                                };
                                const tc = typeColors[log.type] || { bg: "rgba(255,255,255,0.08)", color: "#b0b0b0" };

                                let detailParts = [];
                                if (log.type === "Completion") {
                                    if (d.yards) detailParts.push(`${d.yards} Yards`);
                                    if (d.passer) detailParts.push(`Passer #${d.passer}`);
                                    if (d.receiver) detailParts.push(`Receiver #${d.receiver}`);
                                    if (d.flagPull) detailParts.push(`Flag Pull: #${d.flagPull}`);
                                    if (d.points && d.points !== "None") detailParts.push(d.points);
                                } else if (log.type === "Incompletion") {
                                    if (d.passer) detailParts.push(`Passer #${d.passer}`);
                                } else if (log.type === "Interception") {
                                    if (d.passer) detailParts.push(`Passer #${d.passer}`);
                                    if (d.defender) detailParts.push(`Defender #${d.defender}`);
                                    if (d.flagPull) detailParts.push(`Flag Pull: #${d.flagPull}`);
                                    if (d.points && d.points !== "None") detailParts.push(d.points);
                                } else if (log.type === "Sack") {
                                    if (d.passer) detailParts.push(`Passer #${d.passer}`);
                                    if (d.defender) detailParts.push(`Defender #${d.defender}`);
                                    if (d.safety) detailParts.push("Safety");
                                } else if (log.type === "Fumble") {
                                    if (d.defender) detailParts.push(`Defender #${d.defender}`);
                                    if (d.flagPull) detailParts.push(`Flag Pull: #${d.flagPull}`);
                                    if (d.points && d.points !== "None") detailParts.push(d.points);
                                } else if (log.type === "Run") {
                                    if (d.yards) detailParts.push(`${d.yards} Yards`);
                                    if (d.rusher) detailParts.push(`Rusher #${d.rusher}`);
                                    if (d.flagPull) detailParts.push(`Flag Pull: #${d.flagPull}`);
                                    if (d.points && d.points !== "None") detailParts.push(d.points);
                                }

                                const typeLabel = log.type === "Incompletion" ? "Incomplete Pass" : (log.type || log.action);

                                return (
                                    <div
                                        key={i}
                                        style={{
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "flex-start",
                                            padding: "8px 10px",
                                            fontSize: 12,
                                            color: "#b0b0b0",
                                            borderBottom: "1px solid rgba(255,255,255,0.05)",
                                            gap: 8,
                                        }}
                                    >
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: detailParts.length > 0 ? 3 : 0 }}>
                                                <span style={{
                                                    display: "inline-block",
                                                    padding: "1px 7px",
                                                    borderRadius: 4,
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    background: tc.bg,
                                                    color: tc.color,
                                                    whiteSpace: "nowrap",
                                                }}>
                                                    {typeLabel}
                                                </span>
                                                <span style={{ color: "#888", fontSize: 11 }}>— {log.team}</span>
                                            </div>
                                            {detailParts.length > 0 && (
                                                <div style={{ fontSize: 11, color: "#999", lineHeight: 1.5, paddingLeft: 2 }}>
                                                    {detailParts.join(" · ")}
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, paddingTop: 2 }}>
                                            <span style={{ fontSize: 11, color: "#666" }}>{log.half}</span>
                                            {!isViewOnly && ['Completion', 'Incompletion', 'Interception', 'Sack', 'Run', 'Fumble'].includes(log.type) && (
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
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {!isGameFinished && (
                <BottomFooter
                    onCancel={() => setShowCancelConfirm(true)}
                    onForfeit={() => setShowForfeitConfirm(true)}
                    onComplete={() => {
                        if (isPaused) {
                            setIsPaused(false);
                            showToast("Game resumed", "success");
                        } else {
                            setShowCompleteConfirm(true);
                        }
                    }}
                    onReset={handleReset}
                    isPaused={isPaused}
                />
                )}

                {/* Cancel Game Confirmation */}
                {showCancelConfirm && (
                    <div className="confirm-overlay" onClick={() => setShowCancelConfirm(false)}>
                        <div className="confirm-box" onClick={e => e.stopPropagation()}>
                            <h4>Cancel Game?</h4>
                            <p>Are you sure you want to cancel this game?</p>
                            <p className="confirm-detail">This will mark the game as cancelled.</p>
                            <div className="confirm-actions">
                                <button className="btn btn-secondary" onClick={() => setShowCancelConfirm(false)}>No, Go Back</button>
                                <button className="btn btn-danger" onClick={async () => {
                                    try {
                                        await apiPut(`/api/games/${gameId}`, { status: "cancelled" });
                                        showToast("Game cancelled", "success");
                                        setShowCancelConfirm(false);
                                        router.push("/matches");
                                    } catch (err) {
                                        showToast(err.message, "error");
                                    }
                                }}>Yes, Cancel Game</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Forfeit Game Confirmation */}
                {showForfeitConfirm && (
                    <div className="confirm-overlay" onClick={() => setShowForfeitConfirm(false)}>
                        <div className="confirm-box" onClick={e => e.stopPropagation()}>
                            <h4>Forfeit Game?</h4>
                            <p>
                                {activeTeam === "A" ? game?.teamA?.name : game?.teamB?.name} will forfeit.
                            </p>
                            <p className="confirm-detail">
                                Final score will be {game?.teamA?.name} {activeTeam === "A" ? 0 : 6} - {activeTeam === "B" ? 0 : 6} {game?.teamB?.name}.
                            </p>
                            <div className="confirm-actions">
                                <button className="btn btn-secondary" onClick={() => setShowForfeitConfirm(false)}>No, Go Back</button>
                                <button className="btn btn-danger" onClick={async () => {
                                    try {
                                        await apiPut(`/api/games/${gameId}`, {
                                            status: "completed",
                                            "teamA.score": activeTeam === "A" ? 0 : 6,
                                            "teamB.score": activeTeam === "B" ? 0 : 6,
                                        });
                                        showToast("Game forfeited and completed", "success");
                                        setShowForfeitConfirm(false);
                                        router.push("/matches");
                                    } catch (err) {
                                        showToast(err.message, "error");
                                    }
                                }}>Yes, Forfeit</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Complete Game Confirmation */}
                {showCompleteConfirm && (
                    <div className="confirm-overlay" onClick={() => setShowCompleteConfirm(false)}>
                        <div className="confirm-box" onClick={e => e.stopPropagation()}>
                            <h4>Complete Game?</h4>
                            <p>Are you sure you want to end this game?</p>
                            <p className="confirm-detail">{game?.teamA?.name} {game?.teamA?.score ?? 0} — {game?.teamB?.score ?? 0} {game?.teamB?.name}</p>
                            <div className="confirm-actions">
                                <button className="btn btn-secondary" onClick={() => setShowCompleteConfirm(false)}>No, Go Back</button>
                                <button className="btn btn-primary" onClick={async () => {
                                    try {
                                        await apiPut(`/api/games/${gameId}`, { status: "completed" });
                                        showToast("Game completed!", "success");
                                        setShowCompleteConfirm(false);
                                        router.push("/matches");
                                    } catch (err) {
                                        showToast(err.message, "error");
                                    }
                                }}>Yes, Complete Game</button>
                            </div>
                        </div>
                    </div>
                )}
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
