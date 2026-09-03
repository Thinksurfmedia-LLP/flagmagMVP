"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiPut, apiPost } from "../lib/api";
import { formatTimePDT, formatDatePST } from "../lib/timeUtils";

function useGameCountdown(date, time) {
    const [msLeft, setMsLeft] = useState(null);

    useEffect(() => {
        if (!date || !time) return;
        const [hStr, mStr] = time.split(":");
        const h = parseInt(hStr, 10);
        const m = parseInt(mStr, 10);
        if (isNaN(h) || isNaN(m)) return;
        // game.time is PDT (UTC-7); convert to UTC ms from midnight UTC of game.date
        const gameStartMs = new Date(date).getTime() + (h + 7) * 3600000 + m * 60000;
        const tick = () => setMsLeft(gameStartMs - Date.now());
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [date, time]);

    return msLeft;
}

function formatCountdown(ms) {
    if (ms === null) return null;
    if (ms <= 0) return "Starting soon";
    const s = Math.floor(ms / 1000);
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m ${secs}s`;
}

const MIN_PLAYERS_TO_START = 4;

function isPlaceholderTeamName(name) {
    if (!name || !String(name).trim()) return true;
    const n = String(name).trim().toLowerCase();
    return (
        n === "tbd" ||
        n === "to be decided" ||
        n.includes("winner") ||
        n.includes("loser")
    );
}

export default function MatchCard({ game, onStart, onGamesChanged }) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [allTeams, setAllTeams] = useState([]);
    const [loadingTeams, setLoadingTeams] = useState(false);
    const [teamASelection, setTeamASelection] = useState("");
    const [teamBSelection, setTeamBSelection] = useState("");
    const [startError, setStartError] = useState("");
    const [starting, setStarting] = useState(false);
    const [showResetFixtureConfirm, setShowResetFixtureConfirm] = useState(false);
    const [resettingFixture, setResettingFixture] = useState(false);
    const [resetFixtureError, setResetFixtureError] = useState("");
    const router = useRouter();
    const msLeft = useGameCountdown(game.date, game.time);
    const countdown = game.status === "upcoming" ? formatCountdown(msLeft) : null;
    const formatDate = (dateStr) => formatDatePST(dateStr);
    const formatTime = (timeStr) => formatTimePDT(timeStr);
    const needsTeamEdit =
        game.status === "upcoming" &&
        (isPlaceholderTeamName(game.teamA?.name) || isPlaceholderTeamName(game.teamB?.name));
    const hasOriginalFixture = !!(game.originalTeamA?.name || game.originalTeamB?.name);

    const statusLabel = {
        upcoming: "Upcoming",
        in_progress: "Live",
        completed: "Completed",
    };

    const loadTeamsForEditing = async () => {
        if (allTeams.length > 0 || loadingTeams) return;
        setLoadingTeams(true);
        setStartError("");
        try {
            const res = await apiGet("/api/teams");
            const teams = Array.isArray(res.data) ? res.data : [];
            const realTeams = teams.filter((t) => !t.isPlaceholder && !isPlaceholderTeamName(t?.name));
            const leagueTeams = game.league
                ? realTeams.filter((t) => (t.leagues || []).some((m) => String(m.league?._id || m.league || "") === String(game.league)))
                : realTeams;
            setAllTeams(leagueTeams);

            const currentA = leagueTeams.find((t) => t?.name === game.teamA?.name);
            const currentB = leagueTeams.find((t) => t?.name === game.teamB?.name);
            if (currentA?._id) setTeamASelection(String(currentA._id));
            if (currentB?._id) setTeamBSelection(String(currentB._id));

            if (leagueTeams.length === 0) {
                setStartError("No teams are available to assign for this game.");
            }
        } catch (err) {
            setStartError(err.message || "Failed to load teams");
        } finally {
            setLoadingTeams(false);
        }
    };

    const handleOpenStartModal = async () => {
        setShowConfirm(true);
        if (needsTeamEdit) {
            await loadTeamsForEditing();
        }
    };

    const handleStartGame = async () => {
        setStartError("");
        setStarting(true);
        try {
            const payload = { status: "in_progress" };

            if (needsTeamEdit) {
                if (!teamASelection || !teamBSelection) {
                    setStartError("Please select both teams before starting.");
                    setStarting(false);
                    return;
                }
                if (teamASelection === teamBSelection) {
                    setStartError("Team 1 and Team 2 must be different.");
                    setStarting(false);
                    return;
                }

                const teamA = allTeams.find((t) => String(t._id) === teamASelection);
                const teamB = allTeams.find((t) => String(t._id) === teamBSelection);
                if (!teamA || !teamB) {
                    setStartError("Selected teams are invalid. Please try again.");
                    setStarting(false);
                    return;
                }

                payload.teamA = {
                    name: teamA.name,
                    logo: teamA.logo || "",
                    score: game.teamA?.score ?? 0,
                };
                payload.teamB = {
                    name: teamB.name,
                    logo: teamB.logo || "",
                    score: game.teamB?.score ?? 0,
                };
            }

            // Both teams need a minimum roster before a game can be started.
            // With placeholder teams being reassigned, check the freshly
            // selected teams' own player lists (already loaded in allTeams)
            // instead of the game's roster, which still reflects the old
            // placeholder matchup at this point.
            let countA, countB, nameA, nameB;
            if (needsTeamEdit) {
                const teamA = allTeams.find((t) => String(t._id) === teamASelection);
                const teamB = allTeams.find((t) => String(t._id) === teamBSelection);
                countA = (teamA?.players || []).length;
                countB = (teamB?.players || []).length;
                nameA = teamA?.name;
                nameB = teamB?.name;
            } else {
                const rosterRes = await apiGet(`/api/games/${game._id}/roster`);
                countA = (rosterRes.data?.teamA || []).length;
                countB = (rosterRes.data?.teamB || []).length;
                nameA = game.teamA?.name;
                nameB = game.teamB?.name;
            }
            const shortTeams = [nameA && countA < MIN_PLAYERS_TO_START ? nameA : null, nameB && countB < MIN_PLAYERS_TO_START ? nameB : null].filter(Boolean);
            if (shortTeams.length > 0) {
                setStartError(`${shortTeams.join(" and ")} ${shortTeams.length > 1 ? "need" : "needs"} at least ${MIN_PLAYERS_TO_START} players before starting.`);
                setStarting(false);
                return;
            }

            await apiPut(`/api/games/${game._id}`, payload);
            setShowConfirm(false);
            router.push(`/matches/${game._id}`);
        } catch (err) {
            setStartError(err.message || "Failed to start game");
        } finally {
            setStarting(false);
        }
    };

    const handleResetFixture = async () => {
        setResetFixtureError("");
        setResettingFixture(true);
        try {
            await apiPost(`/api/games/${game._id}/reset-fixture`);
            setShowResetFixtureConfirm(false);
            onGamesChanged?.();
        } catch (err) {
            setResetFixtureError(err.message || "Failed to reset fixture");
        } finally {
            setResettingFixture(false);
        }
    };

    return (
        <div className="match-box">
            <div className="badge-wrap">
                <span className={`status-badge ${game.status}`}>
                    {statusLabel[game.status] || game.status}
                </span>
            </div>
            <div className="top">
                <div className="a">
                    <div className="team-img">
                        <img
                            src={game.teamA?.logo || "/assets/images/team-placeholder.svg"}
                            alt={game.teamA?.name || "Team A"}
                        />
                    </div>
                    <h5>{game.teamA?.name || "Team A"}</h5>
                </div>
                <div className="b">
                    {game.status === "completed" || game.status === "in_progress" ? (
                        <div className="score-display">
                            <h3>
                                <span>{game.teamA?.score ?? 0}</span>
                                {" : "}
                                <span>{game.teamB?.score ?? 0}</span>
                            </h3>
                        </div>
                    ) : (
                        <img src="/assets/images/vs.png" alt="VS" />
                    )}
                </div>
                <div className="a">
                    <div className="team-img">
                        <img
                            src={game.teamB?.logo || "/assets/images/team-placeholder.svg"}
                            alt={game.teamB?.name || "Team B"}
                        />
                    </div>
                    <h5>{game.teamB?.name || "Team B"}</h5>
                </div>
            </div>
            <hr />
            <div className="bottom">
                <div className="left">
                    <ul>
                        <li>
                            Time – <span>{formatDate(game.date)}{game.time ? `, ${formatTime(game.time)}` : ""}</span>
                        </li>
                        {countdown && (
                            <li>
                                Starts In – <span className="countdown-timer">{countdown}</span>
                            </li>
                        )}
                        <li>
                            Location – <span>{game.location || "TBD"}</span>
                        </li>
                        <li>
                            Status – <span>{statusLabel[game.status] || game.status}</span>
                        </li>
                    </ul>
                </div>
                <div className="right">
                    {game.status === "upcoming" && (
                        <button
                            className="btn btn-primary"
                            onClick={handleOpenStartModal}
                        >
                            Start Game
                        </button>
                    )}
                    {game.status === "upcoming" && hasOriginalFixture && (
                        <button
                            className="btn btn-info-primary"
                            style={{ marginLeft: 8 }}
                            onClick={() => setShowResetFixtureConfirm(true)}
                        >
                            Reset Fixture
                        </button>
                    )}
                    {game.status === "in_progress" && (
                        <Link href={`/matches/${game._id}`} className="btn btn-primary">
                            Continue
                        </Link>
                    )}
                    {game.status === "completed" && (
                        <Link href={`/matches/${game._id}`} className="btn btn-info-primary">
                            View Stats
                        </Link>
                    )}
                </div>
            </div>

            {showConfirm && (
                <div className="confirm-overlay" onClick={() => setShowConfirm(false)}>
                    <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
                        <h4>Start This Game?</h4>
                        <p>
                            <strong>{game.teamA?.name || "Team A"}</strong> vs <strong>{game.teamB?.name || "Team B"}</strong>
                        </p>
                        {game.date && (
                            <p className="confirm-detail">
                                {formatDate(game.date)}{game.time ? `, ${formatTime(game.time)}` : ""}
                                {game.location ? ` — ${game.location}` : ""}
                            </p>
                        )}
                        {needsTeamEdit && (
                            <>
                                <p className="confirm-detail" style={{ color: "#ff9f43" }}>
                                    This game has placeholder teams. Select the final teams before starting.
                                </p>
                                <div className="form-group" style={{ textAlign: "left" }}>
                                    <label>Team 1</label>
                                    <select
                                        className="form-control select-form-control"
                                        value={teamASelection}
                                        onChange={(e) => setTeamASelection(e.target.value)}
                                        disabled={loadingTeams || starting}
                                    >
                                        <option value="">Select Team 1</option>
                                        {allTeams
                                            .filter((team) => String(team._id) !== teamBSelection)
                                            .map((team) => (
                                                <option key={team._id} value={team._id}>{team.name}</option>
                                            ))}
                                    </select>
                                </div>
                                <div className="form-group" style={{ textAlign: "left" }}>
                                    <label>Team 2</label>
                                    <select
                                        className="form-control select-form-control"
                                        value={teamBSelection}
                                        onChange={(e) => setTeamBSelection(e.target.value)}
                                        disabled={loadingTeams || starting}
                                    >
                                        <option value="">Select Team 2</option>
                                        {allTeams
                                            .filter((team) => String(team._id) !== teamASelection)
                                            .map((team) => (
                                                <option key={team._id} value={team._id}>{team.name}</option>
                                            ))}
                                    </select>
                                </div>
                            </>
                        )}
                        {startError && (
                            <p className="confirm-detail" style={{ color: "#ff5a5a" }}>{startError}</p>
                        )}
                        <div className="confirm-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    setShowConfirm(false);
                                    setStartError("");
                                }}
                                disabled={starting}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleStartGame}
                                disabled={loadingTeams || starting}
                            >
                                {starting ? "Starting..." : "Yes, Start Game"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showResetFixtureConfirm && (
                <div className="confirm-overlay" onClick={() => setShowResetFixtureConfirm(false)}>
                    <div className="confirm-box" onClick={(e) => e.stopPropagation()}>
                        <h4>Reset Fixture?</h4>
                        <p>
                            This will revert this game back to its original placeholder matchup:{" "}
                            <strong>{game.originalTeamA?.name || game.teamA?.name}</strong> vs{" "}
                            <strong>{game.originalTeamB?.name || game.teamB?.name}</strong>.
                        </p>
                        {resetFixtureError && (
                            <p className="confirm-detail" style={{ color: "#ff5a5a" }}>{resetFixtureError}</p>
                        )}
                        <div className="confirm-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    setShowResetFixtureConfirm(false);
                                    setResetFixtureError("");
                                }}
                                disabled={resettingFixture}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleResetFixture}
                                disabled={resettingFixture}
                            >
                                {resettingFixture ? "Resetting..." : "Yes, Reset"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
