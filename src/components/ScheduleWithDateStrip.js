"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function MatchCard({ game, orgSlug, seasonSlug }) {
    const gameStatsUrl = `/organizations/${orgSlug}/season/${seasonSlug}/game/${game._id}/stats`;
    return (
        <div className="col-xl-6">
            <div className="organization-team-area">
                <div className="top">
                    <ul>
                        <li><img src="/assets/images/icon-clock.png" alt="" /> Time - <span>{game.time}</span></li>
                        <li><img src="/assets/images/icon-calander.png" alt="" /> Date - <span>{new Date(game.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" })}</span></li>
                    </ul>
                </div>
                <div className="middle">
                    <div className="a">
                        <Link href={gameStatsUrl}>
                            <img src={game.teamA.logo || "/assets/images/team1.png"} alt="" />
                        </Link>
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
                        <Link href={gameStatsUrl}>
                            <img src={game.teamB.logo || "/assets/images/team2.png"} alt="" />
                        </Link>
                        <h6>{game.teamB.name}</h6>
                    </div>
                </div>
                <div className="bottom">
                    <ul>
                        <li><img src="/assets/images/icon-map.png" alt="" /> Locations - <span>{game.location}</span></li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" });
}

export default function ScheduleWithDateStrip({ games, orgSlug, seasonSlug }) {
    // Get unique game dates sorted
    const uniqueDates = useMemo(() => {
        const dates = [...new Set(games.map(g => new Date(g.date).toISOString().split("T")[0]))];
        dates.sort();
        return dates;
    }, [games]);

    const [selectedIdx, setSelectedIdx] = useState(0);

    if (uniqueDates.length === 0) {
        return (
            <div className="organization-teams-wrap row g-4 g-xxl-5">
                <div className="col-12 text-center py-4"><p>No games scheduled yet.</p></div>
            </div>
        );
    }

    const prevIdx = selectedIdx > 0 ? selectedIdx - 1 : null;
    const nextIdx = selectedIdx < uniqueDates.length - 1 ? selectedIdx + 1 : null;

    const filteredGames = games.filter(g =>
        new Date(g.date).toISOString().split("T")[0] === uniqueDates[selectedIdx]
    );

    return (
        <>
            <div className="organization-date-wrap">
                <div className="prev" onClick={() => prevIdx !== null && setSelectedIdx(prevIdx)} style={{ cursor: prevIdx !== null ? "pointer" : "default", visibility: prevIdx !== null ? "visible" : "hidden" }}>
                    <span>&lt;</span>
                    <p>{prevIdx !== null ? formatDate(uniqueDates[prevIdx]) : ""}</p>
                </div>
                <div className="current">
                    <p>{formatDate(uniqueDates[selectedIdx])}</p>
                </div>
                <div className="next" onClick={() => nextIdx !== null && setSelectedIdx(nextIdx)} style={{ cursor: nextIdx !== null ? "pointer" : "default", visibility: nextIdx !== null ? "visible" : "hidden" }}>
                    <p>{nextIdx !== null ? formatDate(uniqueDates[nextIdx]) : ""}</p>
                    <span>&gt;</span>
                </div>
            </div>

            <div className="organization-teams-wrap row g-4 g-xxl-5">
                {filteredGames.length > 0 ? filteredGames.map((game) => (
                    <MatchCard key={game._id} game={game} orgSlug={orgSlug} seasonSlug={seasonSlug} />
                )) : (
                    <div className="col-12 text-center py-4"><p>No games on this date.</p></div>
                )}
            </div>
        </>
    );
}
