"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PlayerStatsFilter from "@/components/PlayerStatsFilter";

export default function StatsPage() {
    const [orgs, setOrgs] = useState([]);
    const [leagues, setLeagues] = useState([]);
    const [teams, setTeams] = useState([]);

    const [selectedOrg, setSelectedOrg] = useState(null);   // { slug, name }
    const [selectedLeague, setSelectedLeague] = useState(null); // { slug, name }

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
                // Sort by numeric age prefix (8u, 10u, etc.) then alphabetically
                list.sort((a, b) => parseInt(a.name) - parseInt(b.name) || a.name.localeCompare(b.name));
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

    const handleOrgChange = (e) => {
        const slug = e.target.value;
        if (!slug) { setSelectedOrg(null); return; }
        const org = orgs.find((o) => o.slug === slug);
        setSelectedOrg(org ? { slug: org.slug, name: org.name } : null);
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

                    {/* Page title */}
                    <div className="heading-area" style={{ marginBottom: 32 }}>
                        <h2>Player Stats</h2>
                        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 15, marginTop: 6 }}>
                            Select a league and season below to explore player statistics.
                        </p>
                    </div>

                    {/* Filters */}
                    <div className="stats-page-filters">
                        <div className="stats-filter-item">
                            <label className="stats-filter-label">Organization</label>
                            <select
                                className="stats-filter-select"
                                onChange={handleOrgChange}
                                defaultValue=""
                                disabled={loadingOrgs}
                            >
                                <option value="">{loadingOrgs ? "Loading…" : "Select organization"}</option>
                                {orgs.map((org) => (
                                    <option key={org.slug} value={org.slug}>{org.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="stats-filter-item">
                            <label className="stats-filter-label">League / Season</label>
                            <select
                                className="stats-filter-select"
                                onChange={handleLeagueChange}
                                defaultValue=""
                                disabled={!selectedOrg || loadingLeagues}
                            >
                                <option value="">
                                    {!selectedOrg ? "Select organization first" : loadingLeagues ? "Loading…" : "Select league"}
                                </option>
                                {leagues.map((l) => (
                                    <option key={l.slug} value={l.slug}>{l.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Stats table — only shown when both are selected */}
                    {selectedOrg && selectedLeague && (
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

                    {/* Empty state */}
                    {(!selectedOrg || !selectedLeague) && (
                        <div className="stats-page-empty">
                            <img src="/assets/images/icon-star.png" alt="" style={{ width: 52, opacity: 0.3, marginBottom: 20 }} />
                            <h3>Choose an organization and league to view stats</h3>
                            <p>Select from the dropdowns above to get started.</p>
                        </div>
                    )}

                </div>
            </section>

            <Footer />
        </>
    );
}
