"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthProvider, useAuth } from "../lib/AuthContext";
import { apiGet } from "../lib/api";
import MobileHeader from "../components/MobileHeader";
import MatchCard from "../components/MatchCard";

function MatchListContent() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState("today");
    const [games, setGames] = useState([]);
    const [filteredGames, setFilteredGames] = useState([]);
    const [loadingGames, setLoadingGames] = useState(true);
    const [search, setSearch] = useState("");
    const [showFilter, setShowFilter] = useState(false);
    const [leagues, setLeagues] = useState([]);
    const [filterLeague, setFilterLeague] = useState("");
    const [filterTeam, setFilterTeam] = useState("");
    const [filterLocation, setFilterLocation] = useState("");

    // Redirect if not logged in
    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [authLoading, user, router]);

    // Fetch leagues
    useEffect(() => {
        if (!user?.organization?.slug) return;
        apiGet(`/api/organizations/${user.organization.slug}/leagues`)
            .then((res) => setLeagues(res.data || []))
            .catch(() => {});
    }, [user]);

    // Fetch games from all leagues
    const fetchGames = useCallback(async () => {
        if (!leagues.length) return;
        setLoadingGames(true);
        try {
            const allGames = [];
            for (const league of leagues) {
                const res = await apiGet(`/api/seasons/${league._id}/games`);
                if (res.data) {
                    allGames.push(
                        ...res.data.map((g) => ({
                            ...g,
                            leagueName: league.name,
                            leagueCategory: league.category,
                        }))
                    );
                }
            }
            // Sort by date
            allGames.sort((a, b) => new Date(a.date) - new Date(b.date));
            setGames(allGames);
        } catch (err) {
            console.error("Error fetching games:", err);
        } finally {
            setLoadingGames(false);
        }
    }, [leagues]);

    useEffect(() => {
        fetchGames();
    }, [fetchGames]);

    // Filter games by tab + search + filters
    useEffect(() => {
        let filtered = [...games];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Tab filter
        if (activeTab === "today") {
            filtered = filtered.filter((g) => {
                const d = new Date(g.date);
                return d >= today && d < tomorrow;
            });
        } else if (activeTab === "upcoming") {
            filtered = filtered.filter(
                (g) => g.status === "upcoming" && new Date(g.date) >= tomorrow
            );
        } else if (activeTab === "completed") {
            filtered = filtered.filter((g) => g.status === "completed");
        }

        // Search filter
        if (search.trim()) {
            const q = search.toLowerCase();
            filtered = filtered.filter(
                (g) =>
                    g.teamA?.name?.toLowerCase().includes(q) ||
                    g.teamB?.name?.toLowerCase().includes(q) ||
                    g.location?.toLowerCase().includes(q) ||
                    g.leagueName?.toLowerCase().includes(q)
            );
        }

        // Dropdown filters
        if (filterTeam) {
            filtered = filtered.filter(
                (g) =>
                    g.teamA?.name?.toLowerCase() === filterTeam.toLowerCase() ||
                    g.teamB?.name?.toLowerCase() === filterTeam.toLowerCase()
            );
        }
        if (filterLocation) {
            filtered = filtered.filter(
                (g) => g.location?.toLowerCase() === filterLocation.toLowerCase()
            );
        }
        if (filterLeague) {
            filtered = filtered.filter(
                (g) => g.leagueName?.toLowerCase() === filterLeague.toLowerCase()
            );
        }

        setFilteredGames(filtered);
    }, [games, activeTab, search, filterTeam, filterLocation, filterLeague]);

    // Derive unique teams, locations for filter dropdowns
    const allTeams = [
        ...new Set(
            games.flatMap((g) => [g.teamA?.name, g.teamB?.name]).filter(Boolean)
        ),
    ];
    const allLocations = [
        ...new Set(games.map((g) => g.location).filter(Boolean)),
    ];
    const allLeagueNames = [
        ...new Set(games.map((g) => g.leagueName).filter(Boolean)),
    ];

    if (authLoading) {
        return (
            <div className="wrapper">
                <div className="main-section-wrapper">
                    <div className="loading-spinner" />
                </div>
            </div>
        );
    }

    return (
        <div className="wrapper">
            <div className="main-section-wrapper" style={{ alignItems: "flex-start" }}>
                <MobileHeader />

                {/* Search area */}
                <div className="search-area">
                    <input
                        type="text"
                        placeholder="Search Matches..."
                        className="form-control icon-search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <button
                        className="filter-btn"
                        onClick={() => setShowFilter(!showFilter)}
                    >
                        <img src="/assets/images/icon-filter.png" alt="Filter" />
                    </button>

                    <div className={`filter-dropdown ${showFilter ? "active" : ""}`}>
                        <h4>Filter Matches</h4>
                        <div className="form-group">
                            <label>Team</label>
                            <select
                                className="form-control select-form-control"
                                value={filterTeam}
                                onChange={(e) => setFilterTeam(e.target.value)}
                            >
                                <option value="">All Teams</option>
                                {allTeams.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Location</label>
                            <select
                                className="form-control select-form-control"
                                value={filterLocation}
                                onChange={(e) => setFilterLocation(e.target.value)}
                            >
                                <option value="">All Locations</option>
                                {allLocations.map((l) => (
                                    <option key={l} value={l}>{l}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>League</label>
                            <select
                                className="form-control select-form-control"
                                value={filterLeague}
                                onChange={(e) => setFilterLeague(e.target.value)}
                            >
                                <option value="">All Leagues</option>
                                {allLeagueNames.map((l) => (
                                    <option key={l} value={l}>{l}</option>
                                ))}
                            </select>
                        </div>
                        <div className="text-center">
                            <button
                                className="btn btn-primary"
                                onClick={() => setShowFilter(false)}
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tab navigation */}
                <ul className="match-area-nav">
                    {["today", "upcoming", "completed"].map((tab) => (
                        <li
                            key={tab}
                            className={activeTab === tab ? "active" : ""}
                            onClick={() => setActiveTab(tab)}
                        >
                            <a href="#" onClick={(e) => e.preventDefault()}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </a>
                        </li>
                    ))}
                </ul>

                {/* Match list */}
                <div className="match-list-main-wrap">
                    {loadingGames ? (
                        <div className="loading-spinner" />
                    ) : filteredGames.length === 0 ? (
                        <div className="empty-state">
                            <h5>No matches found</h5>
                            <p>
                                {activeTab === "today"
                                    ? "No games scheduled for today."
                                    : activeTab === "upcoming"
                                    ? "No upcoming games."
                                    : "No completed games yet."}
                            </p>
                        </div>
                    ) : (
                        <div className="match-box-wrap">
                            {filteredGames.map((game) => (
                                <MatchCard key={game._id} game={game} />
                            ))}
                        </div>
                    )}

                    <div className="text-center my-3">
                        <Link href="/matches/create" className="btn btn-primary">
                            Create Match
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function MatchesPage() {
    return (
        <AuthProvider>
            <MatchListContent />
        </AuthProvider>
    );
}
