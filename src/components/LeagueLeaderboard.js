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
        { key: "pct", label: "%" },
        { key: "yards", label: "YDS" },
        { key: "tds", label: "TD" },
        { key: "pat", label: "PAT" },
        { key: "ints", label: "INT" },
        { key: "sacks", label: "SCK" },
        { key: "rate", label: "RATING" },
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
        { key: "gamesPlayed", label: "GP" },
        { key: "rushAvgPerGame", label: "AVG/G" },
    ],
    defensive: [
        { key: "dint", label: "INT" },
        { key: "dintTD", label: "INT TD" },
        { key: "dtd", label: "DTD" },
        { key: "dpat", label: "DPAT" },
        { key: "dsacks", label: "SCK" },
        { key: "dsafety", label: "SAF" },
        { key: "flagPulls", label: "FP" },
        { key: "flagPullsPerGame", label: "FP/G" },
    ],
};

const DEFAULT_SORT_KEY = {
    passing: "yards",
    receiving: "yards",
    rushing: "yards",
    defensive: "flagPulls",
};

const ALL_TYPES = Object.keys(statTypeLabels);

function getSorted(players, sortKey, sortDir) {
    return [...players].sort((a, b) => {
        const av = a[sortKey] ?? 0;
        const bv = b[sortKey] ?? 0;
        const cmp = typeof av === "string" ? String(av).localeCompare(String(bv)) : av - bv;
        return sortDir === "asc" ? cmp : -cmp;
    });
}

export default function LeagueLeaderboard({ orgSlug, leagueSlug }) {
    const [allPlayersMap, setAllPlayersMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedTypes, setSelectedTypes] = useState(ALL_TYPES);
    const [sortState, setSortState] = useState({});

    useEffect(() => {
        setLoading(true);
        Promise.all(
            ALL_TYPES.map((type) =>
                fetch(
                    `/api/organizations/${orgSlug}/season/${leagueSlug}/stats/computed?team=&statType=${type}`
                )
                    .then((r) => r.json())
                    .then((d) => [type, d.players || []])
                    .catch(() => [type, []])
            )
        )
            .then((results) => setAllPlayersMap(Object.fromEntries(results)))
            .finally(() => setLoading(false));
    }, [orgSlug, leagueSlug]);

    const toggleType = (type) => {
        setSelectedTypes((prev) =>
            prev.includes(type)
                ? prev.length > 1
                    ? prev.filter((t) => t !== type)
                    : prev
                : [type, ...prev]
        );
    };

    const handleSort = (type, key) => {
        setSortState((prev) => {
            const cur = prev[type] || { key: DEFAULT_SORT_KEY[type], dir: "desc" };
            return {
                ...prev,
                [type]: {
                    key,
                    dir: cur.key === key && cur.dir === "desc" ? "asc" : "desc",
                },
            };
        });
    };

    if (loading) {
        return (
            <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,0.45)" }}>
                Loading leaderboard…
            </div>
        );
    }

    return (
        <>
            {/* Stat type toggles */}
            <div className="stat-type-toggles" style={{ marginBottom: 32 }}>
                {ALL_TYPES.map((key) => (
                    <button
                        key={key}
                        className={`stat-type-btn${selectedTypes.includes(key) ? " active" : ""}`}
                        onClick={() => toggleType(key)}
                    >
                        {statTypeLabels[key]}
                    </button>
                ))}
            </div>

            {selectedTypes.map((type) => {
                const columns = statColumns[type];
                const rawPlayers = allPlayersMap[type] || [];
                const { key: sortKey, dir: sortDir } = sortState[type] || {
                    key: DEFAULT_SORT_KEY[type],
                    dir: "desc",
                };
                const players = getSorted(rawPlayers, sortKey, sortDir);
                const totalCols = columns.length + 3;

                const sortIcon = (key) =>
                    sortKey === key ? (
                        <span className="sort-icon active">{sortDir === "desc" ? "↓" : "↑"}</span>
                    ) : (
                        <span className="sort-icon">⇅</span>
                    );

                return (
                    <div key={type} className="stat-section">
                        <h5 className="stat-section-title">{statTypeLabels[type]}</h5>
                        <div className="organization-stats-table-wrap players-stats">
                            <div className="table-wrap">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: 40, textAlign: "center" }}>#</th>
                                            <th
                                                className="sortable-col"
                                                onClick={() => handleSort(type, "playerName")}
                                                style={{ textAlign: "left" }}
                                            >
                                                PLAYER {sortIcon("playerName")}
                                            </th>
                                            <th
                                                className="sortable-col"
                                                onClick={() => handleSort(type, "teamName")}
                                            >
                                                TEAM {sortIcon("teamName")}
                                            </th>
                                            {columns.map((col) => (
                                                <th
                                                    key={col.key}
                                                    className="sortable-col"
                                                    onClick={() => handleSort(type, col.key)}
                                                >
                                                    {col.label} {sortIcon(col.key)}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rawPlayers.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={totalCols}
                                                    style={{
                                                        textAlign: "center",
                                                        padding: "30px 0",
                                                        color: "rgba(255,255,255,0.5)",
                                                    }}
                                                >
                                                    No stats recorded yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            players.map((player, i) => (
                                                <tr key={player.playerId || i}>
                                                    <td className="jersey-num">
                                                        {player.jerseyNumber ? `#${player.jerseyNumber}` : "-"}
                                                    </td>
                                                    <td style={{ textAlign: "left" }}>
                                                        <img
                                                            src={
                                                                player.playerPhoto ||
                                                                "/assets/images/player-placeholder.svg"
                                                            }
                                                            alt=""
                                                        />
                                                        {" "}
                                                        <Link href={`/players/${player.playerId}`}>
                                                            {player.playerName}
                                                        </Link>
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
                    </div>
                );
            })}
        </>
    );
}
