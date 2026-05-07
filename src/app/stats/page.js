"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScrollToContent from "@/components/ScrollToContent";
import ScheduleWithDateStrip from "@/components/ScheduleWithDateStrip";
import LeagueLeaderboard from "@/components/LeagueLeaderboard";
import SeasonLeaderboard from "@/components/SeasonLeaderboard";

// ── Standings table (mirrors game-stats page) ────────────────────────────────
function StandingsView({ orgSlug, leagueSlug }) {
    const [divisionGroups, setDivisionGroups] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/organizations/${orgSlug}/season/${leagueSlug}/standings`)
            .then((r) => r.json())
            .then((d) => setDivisionGroups(d.divisionGroups || []))
            .catch(() => setDivisionGroups([]))
            .finally(() => setLoading(false));
    }, [orgSlug, leagueSlug]);

    if (loading) return <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.45)" }}>Loading standings…</div>;

    const isSingle = divisionGroups.length === 1;
    return (
        <div className={`row${isSingle ? " justify-content-center" : ""}`}>
            {divisionGroups.map((group, i) => (
                <div key={i} className={isSingle ? "col-xl-8 mb-4" : "col-xl-6 mb-4"}>
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                {group.name && <tr className="hd"><th colSpan="6">{group.name}</th></tr>}
                                <tr>
                                    <th>TEAM</th>
                                    <th>W-L</th>
                                    <th>%</th>
                                    <th>PF</th>
                                    <th>PA</th>
                                    <th>+/-</th>
                                </tr>
                            </thead>
                            <tbody>
                                {group.rows.map((team, j) => {
                                    const noGames = team.wins === 0 && team.losses === 0;
                                    return (
                                        <tr key={j}>
                                            <td>
                                                <img src={team.logo || "/assets/images/team-placeholder.svg"} alt="" />
                                                {" "}
                                                <Link 
                                                    href={`/organizations/${orgSlug}/season/${leagueSlug}/player-stats?team=${encodeURIComponent(team.name)}`}
                                                    style={{ color: "#fff", textDecoration: "underline" }}
                                                >
                                                    {team.name}
                                                </Link>
                                            </td>
                                            <td>{team.wins}-{team.losses}</td>
                                            <td>{noGames ? "-" : team.pct.toFixed(2)}</td>
                                            <td>{noGames ? "-" : team.pf}</td>
                                            <td>{noGames ? "-" : team.pa}</td>
                                            <td>{noGames ? "-" : (team.diff > 0 ? `+${team.diff}` : team.diff)}</td>
                                        </tr>
                                    );
                                })}
                                {group.rows.length === 0 && (
                                    <tr><td colSpan="6" style={{ textAlign: "center", color: "#999", padding: "16px" }}>No teams found.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ── League schedule (week selector + game cards) ──────────────────────────────
function LeagueSchedule({ orgSlug, leagueSlug }) {
    const [scheduleData, setScheduleData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/organizations/${orgSlug}/season/${leagueSlug}/schedule`)
            .then((r) => r.json())
            .then((d) => setScheduleData(d.success ? d : null))
            .catch(() => setScheduleData(null))
            .finally(() => setLoading(false));
    }, [orgSlug, leagueSlug]);

    if (loading) return <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.45)" }}>Loading schedule…</div>;
    if (!scheduleData || scheduleData.weekMeta.length === 0) return <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.45)" }}>No games scheduled.</div>;

    return (
        <ScheduleWithDateStrip
            key={`${orgSlug}-${leagueSlug}`}
            weekMeta={scheduleData.weekMeta}
            initialWeekIdx={scheduleData.initialWeekIdx}
            initialGames={scheduleData.initialGames}
            leagueId={scheduleData.leagueId}
            orgSlug={orgSlug}
            seasonSlug={leagueSlug}
        />
    );
}

// ── Org card — same visual as leagues-card on the org detail page ────────────
function OrgCard({ org, onClick }) {
    const categories = org.categories || [];
    const cities = (org.locations || [])
        .map((loc) => loc.cityName || loc.countyName)
        .filter(Boolean);
    const locationText = cities.slice(0, 2).join(", ") + (cities.length > 2 ? ` +${cities.length - 2}` : "");
    const orgImg = org.logo || "/assets/images/org-placeholder.svg";

    return (
        <div className="col-lg-6 mb-4">
            <div
                className="leagues-card stats-org-card"
                onClick={() => onClick(org)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onClick(org)}
            >
                <div className="left">
                    <div className="bg"><img src={orgImg} alt="" /></div>
                    <img src={orgImg} alt={org.name} />
                </div>
                <div className="right">
                    <h5>{org.name}</h5>
                    <ul>
                        <li>
                            <img src="/assets/images/icon-map.png" alt="" />
                            {" "}Location – <span>{locationText || "TBD"}</span>
                        </li>
                        <li>
                            <img src="/assets/images/icon-calander.png" alt="" />
                            {" "}Days – <span>{(org.scheduleDays || []).join(", ") || "TBD"}</span>
                        </li>
                    </ul>
                    {categories.length > 0 && (
                        <ul className="tag" style={{ marginTop: 8 }}>
                            {categories.map((tag, i) => (
                                <li key={i}>{tag}</li>
                            ))}
                        </ul>
                    )}
                    <div className="button-area">
                        <span className="btn btn-primary">View Stats</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function StatsPage() {
    return (
        <Suspense fallback={null}>
            <StatsPageContent />
        </Suspense>
    );
}

function StatsPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const orgSlug = searchParams.get("org");
    const leagueSlug = searchParams.get("league");
    const view = searchParams.get("view"); // "players" → league leaderboard, "leaderboard" → season leaderboard
    const seasonsParam = searchParams.get("seasons") || ""; // comma-separated season IDs for season leaderboard
    const [orgs, setOrgs] = useState([]);
    const [seasons, setSeasons] = useState([]);
    const [leagues, setLeagues] = useState([]);
    const [selectedSeasons, setSelectedSeasons] = useState([]); // array of season _id strings

    const [loadingOrgs, setLoadingOrgs] = useState(true);
    const [loadingSeasons, setLoadingSeasons] = useState(false);
    const [loadingLeagues, setLoadingLeagues] = useState(false);

    // Derive selected org/league objects from URL + fetched data
    const selectedOrg = orgs.find((o) => o.slug === orgSlug) || null;
    const selectedLeague = leagues.find((l) => l.slug === leagueSlug) || null;

    // Fetch organizations on mount
    useEffect(() => {
        fetch("/api/organizations")
            .then((r) => r.json())
            .then((d) => {
                const list = Array.isArray(d) ? d : (d.organizations || d.data || []);
                setOrgs(list);
            })
            .catch(() => setOrgs([]))
            .finally(() => setLoadingOrgs(false));
    }, []);

    // When orgSlug changes — fetch seasons + all leagues
    useEffect(() => {
        if (!orgSlug) {
            setSeasons([]);
            setLeagues([]);
            setSelectedSeasons([]);
            return;
        }
        setLoadingSeasons(true);
        setLoadingLeagues(true);
        setSeasons([]);
        setLeagues([]);
        setSelectedSeasons([]);

        Promise.all([
            fetch(`/api/organizations/${orgSlug}/seasons`).then((r) => r.json()),
            fetch(`/api/organizations/${orgSlug}/leagues`).then((r) => r.json()),
        ]).then(([sData, lData]) => {
            const sList = sData.data || [];
            sList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setSeasons(sList);

            const lList = lData.data || [];
            lList.sort((a, b) => a.name.localeCompare(b.name));
            setLeagues(lList);
        }).catch(() => {})
          .finally(() => { setLoadingSeasons(false); setLoadingLeagues(false); });
    }, [orgSlug]);

    const handleOrgClick = (org) => {
        router.push(`/stats?org=${org.slug}`);
    };

    const toggleSeason = (seasonId) => {
        setSelectedSeasons((prev) =>
            prev.includes(seasonId) ? prev.filter((id) => id !== seasonId) : [...prev, seasonId]
        );
    };

    // Leagues filtered by selected seasons
    const filteredLeagues = selectedSeasons.length === 0
        ? []
        : leagues.filter((l) => {
            const lSeasonId = l.season?._id || l.season;
            return lSeasonId && selectedSeasons.includes(String(lSeasonId));
        });

    return (
        <>
            <Header />
            <Suspense fallback={null}>
                <ScrollToContent />
            </Suspense>

            <section className="innerpage-section type2">
                <div className="banner-area">
                    <img src="/assets/images/banner-placeholder.svg" alt="" />
                </div>
                <div className="container"></div>
            </section>

            <section className="leagues-section section-padding" id="main-content">
                <div className="container">

                    {/* ── Step 1: pick an org ─────────────────────────────── */}
                    {!orgSlug && (
                        <>
                            <div className="heading-area" style={{ marginBottom: 32 }}>
                                <h2>Stats</h2>
                                <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 15, marginTop: 6 }}>
                                    Select an organization below to explore statistics.
                                </p>
                            </div>

                            {loadingOrgs ? (
                                <div className="stats-page-empty">
                                    <p>Loading organizations…</p>
                                </div>
                            ) : orgs.length === 0 ? (
                                <div className="stats-page-empty">
                                    <h3>No organizations found</h3>
                                </div>
                            ) : (
                                <>
                                    <h6 className="item-count" style={{ marginBottom: 24, fontSize: "1.1rem", color: "#fff", fontWeight: 400 }}>
                                        Showing {orgs.length} organization{orgs.length !== 1 ? "s" : ""}
                                    </h6>
                                    <div className="row">
                                        {orgs.map((org) => (
                                            <OrgCard key={org._id} org={org} onClick={handleOrgClick} />
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}

                    {/* ── Step 2: pick seasons (multi-select bubbles) ──────── */}
                    {orgSlug && !leagueSlug && (
                        <>
                            <div className="stats-breadcrumb">
                                <button
                                    className="btn btn-outline-light btn-sm"
                                    onClick={() => router.push("/stats")}
                                >
                                    ← All Organizations
                                </button>
                                <span className="stats-breadcrumb-sep">/</span>
                                {view === "leaderboard" ? (
                                    <>
                                        <button
                                            className="stats-breadcrumb-back-link"
                                            onClick={() => router.push(`/stats?org=${orgSlug}`)}
                                        >
                                            {selectedOrg?.name || orgSlug}
                                        </button>
                                        <span className="stats-breadcrumb-sep">/</span>
                                        <span>
                                            {seasonsParam
                                                .split(",")
                                                .map((id) => seasons.find((s) => String(s._id) === id)?.name)
                                                .filter(Boolean)
                                                .join(", ") || "Leaderboard"}
                                        </span>
                                    </>
                                ) : (
                                    <span>{selectedOrg?.name || orgSlug}</span>
                                )}
                            </div>

                            <div className="heading-area" style={{ marginBottom: 16 }}>
                                <h2>Stats — {selectedOrg?.name || orgSlug}</h2>
                                {view !== "leaderboard" && (
                                    <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 15, marginTop: 6 }}>
                                        Select one or more seasons to see their leagues.
                                    </p>
                                )}
                            </div>

                            {view === "leaderboard" ? (
                                <SeasonLeaderboard
                                    key={`season-lb-${orgSlug}-${seasonsParam}`}
                                    orgSlug={orgSlug}
                                    seasonsParam={seasonsParam}
                                />
                            ) : (
                                <>
                                    {/* Season bubbles */}
                                    {loadingSeasons ? (
                                        <div className="stats-page-empty"><p>Loading seasons…</p></div>
                                    ) : seasons.length === 0 ? (
                                        <div className="stats-page-empty"><h3>No seasons found for this organization.</h3></div>
                                    ) : (
                                        <div className="stats-season-bubbles">
                                            {seasons.map((s) => {
                                                const active = selectedSeasons.includes(String(s._id));
                                                return (
                                                    <button
                                                        key={s._id}
                                                        className={`stats-season-bubble${active ? " active" : ""}`}
                                                        onClick={() => toggleSeason(String(s._id))}
                                                    >
                                                        {s.name}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Leaderboard button + leagues for selected seasons */}
                                    {selectedSeasons.length > 0 && (
                                        <>
                                            <div style={{ marginTop: 32, marginBottom: 16, textAlign: "center" }}>
                                                <button
                                                    className="btn btn-outline-light"
                                                    onClick={() =>
                                                        router.push(
                                                            `/stats?org=${orgSlug}&seasons=${encodeURIComponent(selectedSeasons.join(","))}&view=leaderboard`
                                                        )
                                                    }
                                                >
                                                    📊 Leaderboard
                                                </button>
                                            </div>

                                            <div style={{ marginTop: 32 }}>
                                                <h4 style={{ marginBottom: 24, fontFamily: "DM Sans, sans-serif", fontWeight: 600 }}>
                                                    Leagues
                                                </h4>
                                                {loadingLeagues ? (
                                                    <div className="stats-page-empty"><p>Loading leagues…</p></div>
                                                ) : filteredLeagues.length === 0 ? (
                                                    <div className="stats-page-empty"><h3>No leagues found for the selected season(s).</h3></div>
                                                ) : (
                                                    <div className="row">
                                                        {filteredLeagues.map((l) => (
                                                            <div key={l._id} className="col-lg-6 mb-4">
                                                                <div
                                                                    className="leagues-card stats-org-card"
                                                                    onClick={() => router.push(`/stats?org=${orgSlug}&league=${l.slug}`)}
                                                                    role="button"
                                                                    tabIndex={0}
                                                                    onKeyDown={(e) => e.key === "Enter" && router.push(`/stats?org=${orgSlug}&league=${l.slug}`)}
                                                                >
                                                                    {l.category && <div className="badge">{l.category}</div>}
                                                                    <div className="left">
                                                                        <div className="bg"><img src={l.image || "/assets/images/league-placeholder.svg"} alt="" /></div>
                                                                        <img src={l.image || "/assets/images/league-placeholder.svg"} alt={l.name} />
                                                                    </div>
                                                                    <div className="right">
                                                                        <h5>{l.name}</h5>
                                                                        <ul>
                                                                            <li><img src="/assets/images/icon-map.png" alt="" /> Location – <span>{l.location || "TBD"}</span></li>
                                                                            {l.season?.name && (
                                                                                <li><img src="/assets/images/icon-calander.png" alt="" /> Season – <span>{l.season.name}</span></li>
                                                                            )}
                                                                        </ul>
                                                                        <div className="button-area">
                                                                            <span className="btn btn-primary">View Stats</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    {/* ── Step 3: view stats ──────────────────────────────── */}
                    {orgSlug && leagueSlug && (
                        <>
                            <div className="stats-breadcrumb">
                                <button
                                    className="btn btn-outline-light btn-sm"
                                    onClick={() => router.push("/stats")}
                                >
                                    ← All Organizations
                                </button>
                                <span className="stats-breadcrumb-sep">/</span>
                                <button
                                    className="stats-breadcrumb-back-link"
                                    onClick={() => router.push(`/stats?org=${orgSlug}`)}
                                >
                                    {selectedOrg?.name || orgSlug}
                                </button>
                                <span className="stats-breadcrumb-sep">/</span>
                                {view === "players" ? (
                                    <>
                                        <button
                                            className="stats-breadcrumb-back-link"
                                            onClick={() => router.push(`/stats?org=${orgSlug}&league=${leagueSlug}`)}
                                        >
                                            {selectedLeague?.name || leagueSlug}
                                        </button>
                                        <span className="stats-breadcrumb-sep">/</span>
                                        <span>Leaderboard</span>
                                    </>
                                ) : (
                                    <span>{selectedLeague?.name || leagueSlug}</span>
                                )}
                            </div>

                            <div className="heading-area" style={{ marginBottom: 16 }}>
                                <h2>Stats — {selectedLeague?.name || leagueSlug}</h2>
                            </div>

                            {/* Player Stats / Leaderboard toggle button */}
                            {view !== "players" && (
                                <div style={{ marginBottom: 32, textAlign: "center" }}>
                                    <button
                                        className="btn btn-outline-light"
                                        onClick={() => router.push(`/stats?org=${orgSlug}&league=${leagueSlug}&view=players`)}
                                    >
                                        📊 Leaderboard
                                    </button>
                                </div>
                            )}

                            {view === "players" ? (
                                <LeagueLeaderboard
                                    key={`lb-${orgSlug}-${leagueSlug}`}
                                    orgSlug={orgSlug}
                                    leagueSlug={leagueSlug}
                                />
                            ) : (
                                <>
                                    <StandingsView
                                        key={`${orgSlug}-${leagueSlug}`}
                                        orgSlug={orgSlug}
                                        leagueSlug={leagueSlug}
                                    />

                                    <LeagueSchedule
                                        key={`sched-${orgSlug}-${leagueSlug}`}
                                        orgSlug={orgSlug}
                                        leagueSlug={leagueSlug}
                                    />
                                </>
                            )}
                        </>
                    )}

                </div>
            </section>

            <Footer />
        </>
    );
}
