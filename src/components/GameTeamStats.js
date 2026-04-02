"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const statTypeLabels = {
    passing: "Passing",
    receiving: "Receiving",
    rushing: "Rushing",
    defensive: "Defensive",
};

const statColumns = {
    passing: [
        { key: "atts", label: "ATT" },
        { key: "comp", label: "COMP" },
        { key: "yards", label: "YDS" },
        { key: "tds", label: "TD" },
        { key: "pat", label: "PAT" },
        { key: "ints", label: "INT" },
        { key: "sacks", label: "SCK" },
        { key: "safety", label: "SAF" },
        { key: "pct", label: "CMP%" },
        { key: "ypc", label: "Y/C" },
        { key: "rate", label: "RATE" },
    ],
    receiving: [
        { key: "receptions", label: "REC" },
        { key: "yards", label: "YDS" },
        { key: "tds", label: "TD" },
        { key: "pat", label: "PAT" },
        { key: "ypr", label: "Y/R" },
    ],
    rushing: [
        { key: "atts", label: "ATT" },
        { key: "yards", label: "YDS" },
        { key: "tds", label: "TD" },
        { key: "pat", label: "PAT" },
        { key: "ypc", label: "Y/C" },
    ],
    defensive: [
        { key: "dint", label: "INT" },
        { key: "dintTD", label: "INT TD" },
        { key: "dtd", label: "DTD" },
        { key: "dpat", label: "DPAT" },
        { key: "dsacks", label: "SCK" },
        { key: "dsafety", label: "SAF" },
        { key: "flagPulls", label: "FP" },
    ],
};

export default function GameTeamStats({ teamA, teamB, orgSlug, seasonSlug, gameId }) {
    const [activeTeam, setActiveTeam] = useState("all");
    const [statType, setStatType] = useState("passing");
    const [players, setPlayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    useEffect(() => {
        async function fetchStats() {
            setLoading(true);
            try {
                const teamParam = activeTeam === "all" ? "" : encodeURIComponent(activeTeam);
                const res = await fetch(
                    `/api/games/${gameId}/stats/computed?team=${teamParam}&statType=${statType}`
                );
                const data = await res.json();
                setPlayers(data.players || []);
            } catch (err) {
                console.error("Failed to fetch stats:", err);
                setPlayers([]);
            }
            setLoading(false);
        }
        fetchStats();
    }, [activeTeam, statType, gameId]);

    const columns = statColumns[statType] || statColumns.passing;
    const totalCols = columns.length + 2; // +2 for player and team columns

    return (
        <>
            <div className="row justify-content-between align-items-center players-stats-heading-area">
                <div className="col-auto">
                    <ul className="team-nav">
                        <li className={activeTeam === "all" ? "active" : ""}>
                            <a href="#" onClick={(e) => { e.preventDefault(); setActiveTeam("all"); }}>
                                All Stats
                            </a>
                        </li>
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
                                <th>PLAYER</th>
                                <th>TEAM</th>
                                {columns.map((col) => (
                                    <th key={col.key}>{col.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={totalCols} style={{ textAlign: "center", padding: "30px 0" }}>Loading...</td>
                                </tr>
                            ) : players.length === 0 ? (
                                <tr>
                                    <td colSpan={totalCols} style={{ textAlign: "center", padding: "30px 0" }}>
                                        No stats recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                players.map((player, i) => (
                                    <tr key={player.playerId || i}>
                                        <td>
                                            <img src={player.playerPhoto || "/assets/images/t-logo.jpg"} alt="" />
                                            {" "}
                                            <Link href={`/players/${player.playerId}`}>{player.playerName}</Link>
                                        </td>
                                        <td>{player.teamName}</td>
                                        {columns.map((col) => (
                                            <td key={col.key}>{player[col.key] ?? 0}</td>
                                        ))}
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
