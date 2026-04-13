"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PlayerStatsFilter from "@/components/PlayerStatsFilter";

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
    const [orgs, setOrgs] = useState([]);
    const [leagues, setLeagues] = useState([]);
    const [teams, setTeams] = useState([]);

    const [selectedOrg, setSelectedOrg] = useState(null);
    const [selectedLeague, setSelectedLeague] = useState(null);

    const [loadingOrgs, setLoadingOrgs] = useState(true);
    const [loadingLeagues, setLoadingLeagues] = useState(false);
    const [loadingTeams, setLoadingTeams] = useState(false);

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

    // When org changes — fetch leagues
    useEffect(() => {
        if (!selectedOrg) {
            setLeagues([]);
            setSelectedLeague(null);
            setTeams([]);
            return;
        }
        setLoadingLeagues(true);
        setLeagues([]);
        setSelectedLeague(null);
        setTeams([]);
        fetch(`/api/organizations/${selectedOrg.slug}/leagues`)
            .then((r) => r.json())
            .then((d) => {
                const list = d.data || [];
                list.sort(
                    (a, b) =>
                        parseInt(a.name) - parseInt(b.name) ||
                        a.name.localeCompare(b.name)
                );
                setLeagues(list);
            })
            .catch(() => setLeagues([]))
            .finally(() => setLoadingLeagues(false));
    }, [selectedOrg]);

    // When league changes — fetch teams
    useEffect(() => {
        if (!selectedOrg || !selectedLeague) {
            setTeams([]);
            return;
        }
        setLoadingTeams(true);
        fetch(`/api/organizations/${selectedOrg.slug}/season/${selectedLeague.slug}/teams`)
            .then((r) => r.json())
            .then((d) => setTeams(d.teams || []))
            .catch(() => setTeams([]))
            .finally(() => setLoadingTeams(false));
    }, [selectedOrg, selectedLeague]);

    const handleOrgClick = (org) => {
        setSelectedOrg({ slug: org.slug, name: org.name });
    };

    const handleLeagueChange = (e) => {
        const slug = e.target.value;
        if (!slug) { setSelectedLeague(null); return; }
        const league = leagues.find((l) => l.slug === slug);
        setSelectedLeague(league ? { slug: league.slug, name: league.name } : null);
    };

    return (
        <>
            <Header />

            <section className="innerpage-section type2">
                <div className="banner-area">
                    <img src="/assets/images/banner-placeholder.svg" alt="" />
                </div>
                <div className="container"></div>
            </section>

            <section className="leagues-section section-padding">
                <div className="container">

                    {/* ── Step 1: pick an org ─────────────────────────────── */}
                    {!selectedOrg && (
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

                    {/* ── Step 2: pick league / view stats ────────────────── */}
                    {selectedOrg && (
                        <>
                            {/* Breadcrumb / back */}
                            <div className="stats-breadcrumb">
                                <button
                                    className="btn btn-outline-secondary btn-sm"
                                    onClick={() => { setSelectedOrg(null); setSelectedLeague(null); }}
                                >
                                    ← All Organizations
                                </button>
                                <span className="stats-breadcrumb-sep">/</span>
                                <span>{selectedOrg.name}</span>
                            </div>

                            <div className="heading-area" style={{ marginBottom: 32 }}>
                                <h2>Stats — {selectedOrg.name}</h2>
                                <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 15, marginTop: 6 }}>
                                    Select a league and season below to explore player statistics.
                                </p>
                            </div>

                            {/* League filter */}
                            <div className="stats-page-filters">
                                <div className="stats-filter-item">
                                    <label className="stats-filter-label">League / Season</label>
                                    <select
                                        className="stats-filter-select"
                                        onChange={handleLeagueChange}
                                        defaultValue=""
                                        disabled={loadingLeagues}
                                    >
                                        <option value="">
                                            {loadingLeagues ? "Loading…" : "Select league"}
                                        </option>
                                        {leagues.map((l) => (
                                            <option key={l.slug} value={l.slug}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Stats table */}
                            {selectedLeague && (
                                <div style={{ marginTop: 40 }}>
                                    {loadingTeams ? (
                                        <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.45)" }}>
                                            Loading teams…
                                        </div>
                                    ) : (
                                        <PlayerStatsFilter
                                            key={`${selectedOrg.slug}-${selectedLeague.slug}`}
                                            orgSlug={selectedOrg.slug}
                                            seasonSlug={selectedLeague.slug}
                                            allTeams={teams}
                                        />
                                    )}
                                </div>
                            )}

                            {!selectedLeague && !loadingLeagues && (
                                <div className="stats-page-empty">
                                    <img
                                        src="/assets/images/icon-star.png"
                                        alt=""
                                        style={{ width: 52, opacity: 0.3, marginBottom: 20 }}
                                    />
                                    <h3>Choose a league to view stats</h3>
                                    <p>Select from the dropdown above to get started.</p>
                                </div>
                            )}
                        </>
                    )}

                </div>
            </section>

            <Footer />
        </>
    );
}
