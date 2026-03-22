"use client";

import { useState } from "react";
import Link from "next/link";

export default function PlayerStatsFilter({ playerRows, allTeams }) {
    const [activeTeam, setActiveTeam] = useState("all");

    // No real stats data yet — show coming soon message
    if (playerRows.length === 0) {
        return (
            <div className="organization-stats-table-wrap players-stats">
                <div className="text-center" style={{ padding: "60px 20px" }}>
                    <img src="/assets/images/icon-star.png" alt="" style={{ width: 48, opacity: 0.4, marginBottom: 16 }} />
                    <h3 style={{ marginBottom: 8 }}>Player Stats Coming Soon</h3>
                    <p style={{ opacity: 0.6, fontSize: 15 }}>Stats will appear here once games have been played and recorded.</p>
                </div>
            </div>
        );
    }

    const filteredRows = activeTeam === "all"
        ? playerRows
        : playerRows.filter((p) => p.teamName === activeTeam);

    return (
        <>
            <div className="row justify-content-between align-items-center players-stats-heading-area">
                <div className="col-auto">
                    <ul className="team-nav">
                        <li className={activeTeam === "all" ? "active" : ""}>
                            <a href="#" onClick={(e) => { e.preventDefault(); setActiveTeam("all"); }}>All Players</a>
                        </li>
                        {allTeams.map((team, i) => (
                            <li key={i} className={activeTeam === team.name ? "active" : ""}>
                                <a href="#" onClick={(e) => { e.preventDefault(); setActiveTeam(team.name); }}>{team.name}</a>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="col-auto">
                    <div className="dropdown">
                        <a className="btn btn-info-primary dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                            Passing
                        </a>
                        <ul className="dropdown-menu">
                            <li><a className="dropdown-item" href="#">Passing</a></li>
                            <li><a className="dropdown-item" href="#">Rushing</a></li>
                            <li><a className="dropdown-item" href="#">Receiving</a></li>
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
                            {filteredRows.length === 0 ? (
                                <tr><td colSpan={15} style={{ textAlign: "center", padding: 24, opacity: 0.5 }}>No players found for this team.</td></tr>
                            ) : filteredRows.map((player, i) => (
                                <tr key={i}>
                                    <td><img src={player.photo || "/assets/images/t-logo.jpg"} alt="" /> {player._id ? <Link href={`/players/${player._id}`}>{player.name}</Link> : player.name}</td>
                                    <td>{player._id ? <Link href={`/players/${player._id}`}><img src={player.teamLogo || "/assets/images/t-logo.jpg"} alt="" /></Link> : <img src="/assets/images/t-logo.jpg" alt="" />}</td>
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
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
