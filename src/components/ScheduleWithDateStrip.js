"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";

const teamLogoFallback = "/assets/images/team-placeholder.svg";

function MatchCard({ game, orgSlug, seasonSlug }) {
    const gameStatsUrl = `/organizations/${orgSlug}/season/${seasonSlug}/game/${game._id}/stats`;
    return (
        <div className="col-xl-6">
            <Link href={gameStatsUrl} style={{ textDecoration: "none", display: "block" }}>
                <div className="organization-team-area">
                    <div className="top">
                        <ul>
                            <li><img src="/assets/images/icon-clock.png" alt="" loading="lazy" /> Time - <span>{game.time}</span></li>
                            <li><img src="/assets/images/icon-calander.png" alt="" loading="lazy" /> Date - <span>{new Date(game.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" })}</span></li>
                        </ul>
                    </div>
                    <div className="middle">
                        <div className="a">
                            <img src={game.teamA.logo || teamLogoFallback} alt={game.teamA.name} loading="lazy" />
                            <h6>{game.teamA.name}</h6>
                        </div>
                        <div className="b">
                            {game.status === "completed" ? (
                                <span>{game.teamA.score} - {game.teamB.score}</span>
                            ) : (
                                <span>YET TO BE PLAYED</span>
                            )}
                        </div>
                        <div className="c">
                            <img src={game.teamB.logo || teamLogoFallback} alt={game.teamB.name} loading="lazy" />
                            <h6>{game.teamB.name}</h6>
                        </div>
                    </div>
                    <div className="bottom">
                        <ul>
                            <li><img src="/assets/images/icon-map.png" alt="" loading="lazy" /> Locations - <span>{game.location}</span></li>
                        </ul>
                    </div>
                </div>
            </Link>
        </div>
    );
}

function WeekLoadingSkeleton() {
    return (
        <>
            {[0, 1].map((i) => (
                <div key={i} className="col-xl-6">
                    <div className="organization-team-area" style={{ opacity: 0.5 }}>
                        <div className="top"><ul><li>Loading...</li></ul></div>
                        <div className="middle" style={{ display: "flex", justifyContent: "space-around", padding: "1rem 0" }}>
                            <div style={{ width: 60, height: 60, background: "#e0e0e0", borderRadius: "50%" }} />
                            <div style={{ width: 80, height: 24, background: "#e0e0e0", borderRadius: 4, alignSelf: "center" }} />
                            <div style={{ width: 60, height: 60, background: "#e0e0e0", borderRadius: "50%" }} />
                        </div>
                        <div className="bottom"><ul><li>Loading...</li></ul></div>
                    </div>
                </div>
            ))}
        </>
    );
}

// weekMeta: [{ weekNum, weekStart, gameCount }]
// initialGames: full game objects for initialWeekIdx
// leagueId: string MongoDB _id for the API
export default function ScheduleWithDateStrip({ weekMeta, initialWeekIdx, initialGames, leagueId, orgSlug, seasonSlug }) {
    const [selectedIdx, setSelectedIdx] = useState(initialWeekIdx);
    const [gamesByWeek, setGamesByWeek] = useState(() => ({
        [initialWeekIdx]: initialGames,
    }));
    const [loading, setLoading] = useState(false);
    const abortRef = useRef(null);

    const navigateToWeek = useCallback(async (idx) => {
        setSelectedIdx(idx);

        // Already cached — no fetch needed
        if (gamesByWeek[idx] !== undefined) return;

        // Cancel any in-flight request
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        setLoading(true);
        try {
            const weekStart = weekMeta[idx].weekStart;
            const res = await fetch(`/api/seasons/${leagueId}/games?weekStart=${weekStart}`, {
                signal: abortRef.current.signal,
            });
            const json = await res.json();
            if (json.success) {
                setGamesByWeek((prev) => ({ ...prev, [idx]: json.data }));
            }
        } catch (e) {
            if (e.name !== "AbortError") console.error("Failed to load week:", e);
        } finally {
            setLoading(false);
        }
    }, [gamesByWeek, weekMeta, leagueId]);

    if (!weekMeta || weekMeta.length === 0) {
        return (
            <div className="organization-teams-wrap row g-4 g-xxl-5">
                <div className="col-12 text-center py-4"><p>No games scheduled yet.</p></div>
            </div>
        );
    }

    const prevIdx = selectedIdx > 0 ? selectedIdx - 1 : null;
    const nextIdx = selectedIdx < weekMeta.length - 1 ? selectedIdx + 1 : null;
    const currentGames = gamesByWeek[selectedIdx];

    return (
        <>
            <div className="organization-date-wrap">
                <div
                    className="prev"
                    onClick={() => prevIdx !== null && navigateToWeek(prevIdx)}
                    style={{ cursor: prevIdx !== null ? "pointer" : "default", visibility: prevIdx !== null ? "visible" : "hidden" }}
                >
                    <span>&lt;</span>
                    <p>{prevIdx !== null ? `Week ${weekMeta[prevIdx].weekNum}` : ""}</p>
                </div>
                <div className="current">
                    <p>{`Week ${weekMeta[selectedIdx].weekNum}`}</p>
                </div>
                <div
                    className="next"
                    onClick={() => nextIdx !== null && navigateToWeek(nextIdx)}
                    style={{ cursor: nextIdx !== null ? "pointer" : "default", visibility: nextIdx !== null ? "visible" : "hidden" }}
                >
                    <p>{nextIdx !== null ? `Week ${weekMeta[nextIdx].weekNum}` : ""}</p>
                    <span>&gt;</span>
                </div>
            </div>

            <div className="organization-teams-wrap row g-4 g-xxl-5">
                {loading ? (
                    <WeekLoadingSkeleton />
                ) : currentGames && currentGames.length > 0 ? (
                    currentGames.map((game) => (
                        <MatchCard key={game._id} game={game} orgSlug={orgSlug} seasonSlug={seasonSlug} />
                    ))
                ) : (
                    <div className="col-12 text-center py-4"><p>No games this week.</p></div>
                )}
            </div>
        </>
    );
}
