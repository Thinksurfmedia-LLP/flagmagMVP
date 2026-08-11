import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Game from "@/models/Game";
import League from "@/models/League";
import { requireAdmin, requireAdminOrStatistician } from "@/lib/apiAuth";
import Schedule from "@/models/Schedule";
import Team from "@/models/Team";
import Play from "@/models/Play";
import GameStat from "@/models/GameStat";
import { isPlaceholderTeamName } from "@/lib/placeholderTeams";

// GET single game
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { gameId } = await params;
        const game = await Game.findById(gameId).lean();
        if (!game) {
            return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: game }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// UPDATE game (admin/organizer/statistician)
export async function PUT(request, { params }) {
    try {
        const auth = await requireAdminOrStatistician();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { gameId } = await params;
        const body = await request.json();

        const existing = await Game.findById(gameId).select("league teamA teamB originalTeamA originalTeamB").lean();

        // Validate against league start date
        if (body.date) {
            const leagueId = body.league || existing?.league;
            if (leagueId) {
                const league = await League.findById(leagueId).select("startDate").lean();
                if (league?.startDate) {
                    const gameDate = new Date(body.date);
                    const startDate = new Date(league.startDate);
                    gameDate.setHours(0, 0, 0, 0);
                    startDate.setHours(0, 0, 0, 0);
                    if (gameDate < startDate) {
                        return NextResponse.json(
                            { success: false, error: `Game date cannot be before the league start date (${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})` },
                            { status: 400 }
                        );
                    }
                }
            }
        }

        // Snapshot the placeholder team (e.g. "TBD") the first time it's resolved to a
        // real team, so the fixture can be reverted later via /reset-fixture.
        if (existing) {
            if (body.teamA?.name && isPlaceholderTeamName(existing.teamA?.name) && !isPlaceholderTeamName(body.teamA.name) && !existing.originalTeamA?.name) {
                const placeholderTeam = await Team.findOne({ name: existing.teamA.name }).select("_id").lean();
                body.originalTeamA = { teamId: placeholderTeam?._id || null, name: existing.teamA.name, logo: existing.teamA.logo || "" };
            }
            if (body.teamB?.name && isPlaceholderTeamName(existing.teamB?.name) && !isPlaceholderTeamName(body.teamB.name) && !existing.originalTeamB?.name) {
                const placeholderTeam = await Team.findOne({ name: existing.teamB.name }).select("_id").lean();
                body.originalTeamB = { teamId: placeholderTeam?._id || null, name: existing.teamB.name, logo: existing.teamB.logo || "" };
            }
        }

        const game = await Game.findByIdAndUpdate(gameId, body, { new: true, runValidators: true });
        if (!game) {
            return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 });
        }

        // Sync back to Schedule
        try {
            const teamA = await Team.findOne({ name: game.teamA?.name }).select("_id").lean();
            const teamB = await Team.findOne({ name: game.teamB?.name }).select("_id").lean();

            let field = "";
            if (game.location) {
                const dashIdx = game.location.indexOf(" - ");
                if (dashIdx > -1) {
                    field = game.location.substring(dashIdx + 3);
                }
            }

            const gameDateStr = game.date instanceof Date ? game.date.toISOString().split("T")[0] : new Date(game.date).toISOString().split("T")[0];

            await Schedule.updateMany(
                { "weeks.games.gameRef": game._id },
                {
                    $set: {
                        "weeks.$[w].games.$[g].date": gameDateStr,
                        "weeks.$[w].games.$[g].time": game.time || "",
                        "weeks.$[w].games.$[g].field": field,
                        "weeks.$[w].games.$[g].team1": teamA ? teamA._id : null,
                        "weeks.$[w].games.$[g].team2": teamB ? teamB._id : null
                    }
                },
                {
                    arrayFilters: [
                        { "w.games.gameRef": game._id },
                        { "g.gameRef": game._id }
                    ]
                }
            );
        } catch (syncError) {
            console.error("Failed to sync game update to schedule:", syncError);
        }

        return NextResponse.json({ success: true, data: game }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE game (admin/organizer only)
export async function DELETE(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { gameId } = await params;
        const game = await Game.findByIdAndDelete(gameId);
        if (!game) {
            return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 });
        }

        // Remove the game entry from any schedule that references it
        await Schedule.updateMany(
            { "weeks.games.gameRef": game._id },
            { $pull: { "weeks.$[].games": { gameRef: game._id } } }
        );

        // Cascade-delete dependent play-by-play and box-score data — a game
        // is meaningless once gone, but leaving its Plays/GameStats behind
        // creates dangling refs that silently survive (see Denstar audit:
        // 614 orphaned plays DB-wide from prior deletes that skipped this).
        await Play.deleteMany({ game: game._id });
        await GameStat.deleteMany({ game: game._id });

        return NextResponse.json({ success: true, message: "Game deleted" }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
