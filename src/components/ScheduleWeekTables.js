"use client";

import { useRouter } from "next/navigation";
import { formatDatePST } from "@/lib/timeUtils";

const teamLogoFallback = "/assets/images/team-placeholder.svg";

function GameRow({ game, orgSlug, seasonSlug }) {
    const router = useRouter();
    const isCompleted = game.status === "completed";
    const gameStatsUrl = `/organizations/${orgSlug}/season/${seasonSlug}/game/${game._id}/stats`;

    return (
        <tr
            className="clickable-row"
            onClick={() => router.push(gameStatsUrl)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && router.push(gameStatsUrl)}
            style={{ cursor: "pointer" }}
        >
            <td style={{ textAlign: "left", color: "#FF1E00", fontWeight: 600, whiteSpace: "nowrap" }}>
                {formatDatePST(game.date)}
            </td>
            <td style={{ fontWeight: 700 }}>{isCompleted ? game.teamA?.score ?? 0 : "-"}</td>
            <td style={{ textAlign: "left" }}>
                <img src={game.teamA?.logo || teamLogoFallback} alt="" />
                {game.teamA?.name}
            </td>
            <td style={{ color: "rgba(255,255,255,0.45)", fontSize: 12 }}>vs</td>
            <td style={{ fontWeight: 700 }}>{isCompleted ? game.teamB?.score ?? 0 : "-"}</td>
            <td style={{ textAlign: "left" }}>
                <img src={game.teamB?.logo || teamLogoFallback} alt="" />
                {game.teamB?.name}
            </td>
        </tr>
    );
}

function WeekTable({ week, orgSlug, seasonSlug }) {
    return (
        <div className="table-wrap">
            <table className="table">
                <thead>
                    <tr className="hd"><th colSpan="6">Week {week.weekNum}</th></tr>
                    <tr>
                        <th>Date</th>
                        <th>Pts</th>
                        <th>Team</th>
                        <th></th>
                        <th>Pts</th>
                        <th>Team</th>
                    </tr>
                </thead>
                <tbody>
                    {week.games.map((game) => (
                        <GameRow key={game._id} game={game} orgSlug={orgSlug} seasonSlug={seasonSlug} />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// weeks: [{ weekNum, weekStart, gameCount, games: [...] }]
export default function ScheduleWeekTables({ weeks, orgSlug, seasonSlug }) {
    if (!weeks || weeks.length === 0) {
        return (
            <div className="stats-page-empty">
                <p>No games scheduled yet.</p>
            </div>
        );
    }

    const weeksDesc = [...weeks].reverse();

    return (
        <div className="row">
            {weeksDesc.map((week) => (
                <div key={week.weekStart} className="col-xl-6 mb-4">
                    <WeekTable week={week} orgSlug={orgSlug} seasonSlug={seasonSlug} />
                </div>
            ))}
        </div>
    );
}
