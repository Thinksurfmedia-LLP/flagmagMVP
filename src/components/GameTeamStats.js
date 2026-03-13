"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function GameTeamStats({ teamA, teamB, orgSlug, seasonSlug, gameId, dummyPlayers }) {
    const [activeTeam, setActiveTeam] = useState(teamA.name);
    const [statType, setStatType] = useState("passing");
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    const statTypeLabels = { passing: "Passing", rushing: "Rushing", receiving: "Receiving" };

    useEffect(() => {
        async function fetchStats() {
            setLoading(true);
            try {
                const res = await fetch(
                    `/api/organizations/${orgSlug}/season/${seasonSlug}/game/${gameId}/player-stats?team=${encodeURIComponent(activeTeam)}&statType=${statType}`
                );
                const data = await res.json();
                const fetched = data.players || [];
                setPlayers(fetched.length > 0 ? fetched : (dummyPlayers || []));
            } catch (err) {
                console.error("Failed to fetch stats:", err);
                setPlayers(dummyPlayers || []);
            }
            setLoading(false);
        }
        fetchStats();
    }, [activeTeam, statType, orgSlug, seasonSlug, gameId]);

    return (
        <>
            <div className="row justify-content-between align-items-center players-stats-heading-area">
                <div className="col-auto">
                    <ul className="team-nav">
                        <li className={activeTeam === teamA.name ? "active" : ""}>
                            <a href="#" onClick={(e) => { e.preventDefault(); setActiveTeam(teamA.name); }}>
                                {teamA.name}
                            </a>
                        </li>
                        <li className={activeTeam === teamB.name ? "active" : ""}>
                            <a href="#" onClick={(e) => { e.preventDefault(); setActiveTeam(teamB.name); }}>
                                {teamB.name}
                            </a>
                        </li>
                    </ul>
                </div>
                <div className="col-auto">
                    <div className={`dropdown${dropdownOpen ? " show" : ""}`}>
                        <a
                            className="btn btn-info-primary dropdown-toggle"
                            href="#"
                            role="button"
                            onClick={(e) => { e.preventDefault(); setDropdownOpen(!dropdownOpen); }}
                            aria-expanded={dropdownOpen}
                        >
                            {statTypeLabels[statType]}
                        </a>
                        <ul className={`dropdown-menu${dropdownOpen ? " show" : ""}`}>
                            {Object.entries(statTypeLabels).map(([key, label]) => (
                                <li key={key}>
                                    <a
                                        className="dropdown-item"
                                        href="#"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setStatType(key);
                                            setDropdownOpen(false);
                                        }}
                                    >
                                        {label}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            <div className="organization-stats-table-wrap players-stats">
                <div className="table-wrap">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>players</th>
                                <th>team</th>
                                <th>Rate</th>
                                <th>atts</th>
                                <th>comp</th>
                                <th>tds</th>
                                <th>%</th>
                                <th>xp2</th>
                                <th>yards</th>
                                <th>10+</th>
                                <th>20+</th>
                                <th>40+</th>
                                <th>ints</th>
                                <th>int open</th>
                                <th>int xp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="15" style={{ textAlign: "center", padding: "30px 0" }}>Loading...</td>
                                </tr>
                            ) : players.length === 0 ? (
                                <tr>
                                    <td colSpan="15" style={{ textAlign: "center", padding: "30px 0" }}>No player stats found for this team.</td>
                                </tr>
                            ) : (
                                players.map((player, i) => (
                                    <tr key={player._id || i}>
                                        <td>
                                            <img src={player.photo || "/assets/images/t-logo.jpg"} alt="" />
                                            {" "}
                                            <Link href={`/players/${player._id}`}>{player.name}</Link>
                                        </td>
                                        <td>
                                            <Link href={`/players/${player._id}`}>
                                                <img src={player.teamLogo || "/assets/images/t-logo.jpg"} alt="" />
                                            </Link>
                                        </td>
                                        <td>{player.rate}</td>
                                        <td>{player.atts}</td>
                                        <td>{player.comp}</td>
                                        <td>{player.tds}</td>
                                        <td>{player.pct}</td>
                                        <td>{player.xp2}</td>
                                        <td>{player.yards}</td>
                                        <td>{player.ten}</td>
                                        <td>{player.twenty}</td>
                                        <td>{player.forty}</td>
                                        <td>{player.ints}</td>
                                        <td>{player.intOpen}</td>
                                        <td>{player.intXp}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
