"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { formatTimePDT, formatDatePST } from "@/lib/timeUtils";

const teamLogoFallback = "/assets/images/team-placeholder.svg";

function MatchCard({ game, orgSlug, seasonSlug, orgTimezone }) {
    const gameStatsUrl = `/organizations/${orgSlug}/season/${seasonSlug}/game/${game._id}/stats`;
    return (
        <div className="col-xl-6">
            <Link href={gameStatsUrl} style={{ textDecoration: "none", display: "block" }}>
                <div className="organization-team-area">
                    <div className="top">
                        <ul>
                            <li><img src="/assets/images/icon-clock.png" alt="" loading="lazy" /> Time - <span>{formatTimePDT(game.time, orgTimezone, game.date)}</span></li>
                            <li><img src="/assets/images/icon-calander.png" alt="" loading="lazy" /> Date - <span>{formatDatePST(game.date)}</span></li>
                        </ul>
                    </div>
                    <div className="middle">
                        <div className="a">
                            <img src={game.teamA.logo || teamLogoFallback} alt={game.teamA.name} loading="lazy" />
                            <h6>{game.teamA.name}{game.teamA.seedNumber != null && <span style={{ opacity: 0.7, fontWeight: 400 }}> #{game.teamA.seedNumber}</span>}</h6>
                        </div>
                        <div className="b">
                            {game.status === "completed" ? (
                                <span>{game.teamA.score ?? 0} - {game.teamB.score ?? 0}</span>
                            ) : (
                                <span>YET TO BE PLAYED</span>
                            )}
                        </div>
                        <div className="c">
                            <img src={game.teamB.logo || teamLogoFallback} alt={game.teamB.name} loading="lazy" />
                            <h6>{game.teamB.name}{game.teamB.seedNumber != null && <span style={{ opacity: 0.7, fontWeight: 400 }}> #{game.teamB.seedNumber}</span>}</h6>
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

// sectionMeta: [{ sectionNum, sectionName, gameCount }]
// initialSectionIdx: index into sectionMeta for the first section to show
// initialGames: full game objects for initialSectionIdx
// leagueId: string MongoDB _id for the API
export default function ScheduleWithDateStrip({ sectionMeta, initialSectionIdx, initialGames, leagueId, orgSlug, seasonSlug, orgTimezone = "America/Los_Angeles" }) {
    const [selectedIdx, setSelectedIdx] = useState(initialSectionIdx);
    const [gamesBySection, setGamesBySection] = useState(() => ({
        [initialSectionIdx]: initialGames,
    }));
    const [loading, setLoading] = useState(false);
    const abortRef = useRef(null);

    const navigateToSection = useCallback(async (idx) => {
        setSelectedIdx(idx);

        if (gamesBySection[idx] !== undefined) return;

        const refs = sectionMeta[idx]?.gameRefs || [];
        if (refs.length === 0) {
            setGamesBySection((prev) => ({ ...prev, [idx]: [] }));
            return;
        }

        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        setLoading(true);
        try {
            const url = `/api/seasons/${leagueId}/games?gameIds=${refs.join(",")}`;
            const res = await fetch(url, { signal: abortRef.current.signal });
            const json = await res.json();
            if (json.success) {
                setGamesBySection((prev) => ({ ...prev, [idx]: json.data }));
            }
        } catch (e) {
            if (e.name !== "AbortError") console.error("Failed to load section:", e);
        } finally {
            setLoading(false);
        }
    }, [gamesBySection, sectionMeta, leagueId]);

    if (!sectionMeta || sectionMeta.length === 0) {
        return (
            <div className="organization-teams-wrap row g-4 g-xxl-5">
                <div className="col-12 text-center py-4"><p>No games scheduled yet.</p></div>
            </div>
        );
    }

    const prevIdx = selectedIdx > 0 ? selectedIdx - 1 : null;
    const nextIdx = selectedIdx < sectionMeta.length - 1 ? selectedIdx + 1 : null;
    const currentGames = gamesBySection[selectedIdx];

    const getSectionLabel = (idx) => sectionMeta[idx].sectionName || `Section ${sectionMeta[idx].sectionNum}`;

    return (
        <>
            <div className="organization-date-wrap">
                <div
                    className="prev"
                    onClick={() => prevIdx !== null && navigateToSection(prevIdx)}
                    style={{ cursor: prevIdx !== null ? "pointer" : "default", visibility: prevIdx !== null ? "visible" : "hidden" }}
                >
                    <span>&lt;</span>
                    <p>{prevIdx !== null ? getSectionLabel(prevIdx) : ""}</p>
                </div>
                <div className="current">
                    <p>{getSectionLabel(selectedIdx)}</p>
                </div>
                <div
                    className="next"
                    onClick={() => nextIdx !== null && navigateToSection(nextIdx)}
                    style={{ cursor: nextIdx !== null ? "pointer" : "default", visibility: nextIdx !== null ? "visible" : "hidden" }}
                >
                    <p>{nextIdx !== null ? getSectionLabel(nextIdx) : ""}</p>
                    <span>&gt;</span>
                </div>
            </div>

            <div className="organization-teams-wrap row g-4 g-xxl-5">
                {loading ? (
                    <WeekLoadingSkeleton />
                ) : currentGames && currentGames.length > 0 ? (
                    currentGames.map((game) => (
                        <MatchCard key={game._id} game={game} orgSlug={orgSlug} seasonSlug={seasonSlug} orgTimezone={orgTimezone} />
                    ))
                ) : (
                    <div className="col-12 text-center py-4"><p>No games in this section.</p></div>
                )}
            </div>
        </>
    );
}
