"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiPut } from "../lib/api";
import { formatTimePDT, formatDatePST } from "../lib/timeUtils";

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

export default function MatchCard({ game, onStart }) {
    const [showConfirm, setShowConfirm] = useState(false);
    const [allTeams, setAllTeams] = useState([]);
    const [loadingTeams, setLoadingTeams] = useState(false);
    const [teamASelection, setTeamASelection] = useState("");
    const [teamBSelection, setTeamBSelection] = useState("");
    const [startError, setStartError] = useState("");
    const [starting, setStarting] = useState(false);
    const router = useRouter();
    const formatDate = (dateStr) => formatDatePST(dateStr);
    const formatTime = (timeStr) => formatTimePDT(timeStr);
    const needsTeamEdit =
        game.status === "upcoming" &&
        (isPlaceholderTeamName(game.teamA?.name) || isPlaceholderTeamName(game.teamB?.name));

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
            const realTeams = teams.filter((t) => !isPlaceholderTeamName(t?.name));
            setAllTeams(realTeams);

            const currentA = realTeams.find((t) => t?.name === game.teamA?.name);
            const currentB = realTeams.find((t) => t?.name === game.teamB?.name);
            if (currentA?._id) setTeamASelection(String(currentA._id));
            if (currentB?._id) setTeamBSelection(String(currentB._id));

            if (realTeams.length === 0) {
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

            await apiPut(`/api/games/${game._id}`, payload);
            setShowConfirm(false);
            router.push(`/matches/${game._id}`);
        } catch (err) {
            setStartError(err.message || "Failed to start game");
        } finally {
            setStarting(false);
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
                                        {allTeams.map((team) => (
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
                                        {allTeams.map((team) => (
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
        </div>
    );
}
