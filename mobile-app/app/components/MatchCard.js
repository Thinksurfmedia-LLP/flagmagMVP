"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function MatchCard({ game, onStart }) {
    const [showConfirm, setShowConfirm] = useState(false);
    const router = useRouter();
    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return "";
        return timeStr;
    };

    const statusLabel = {
        upcoming: "Upcoming",
        in_progress: "Live",
        completed: "Completed",
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
                            src={game.teamA?.logo || "/assets/images/team11.jpg"}
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
                            src={game.teamB?.logo || "/assets/images/team22.jpg"}
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
                            onClick={() => setShowConfirm(true)}
                        >
                            Start Match
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
                        <h4>Start This Match?</h4>
                        <p>
                            <strong>{game.teamA?.name || "Team A"}</strong> vs <strong>{game.teamB?.name || "Team B"}</strong>
                        </p>
                        {game.date && (
                            <p className="confirm-detail">
                                {formatDate(game.date)}{game.time ? `, ${formatTime(game.time)}` : ""}
                                {game.location ? ` — ${game.location}` : ""}
                            </p>
                        )}
                        <div className="confirm-actions">
                            <button
                                className="btn btn-secondary"
                                onClick={() => setShowConfirm(false)}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    setShowConfirm(false);
                                    router.push(`/matches/${game._id}`);
                                }}
                            >
                                Yes, Start Match
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
