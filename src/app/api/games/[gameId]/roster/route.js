import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Game from "@/models/Game";
import League from "@/models/League";
import { findGameTeamsWithPlayers } from "@/lib/gameTeams";

// GET roster (players with jersey numbers) for both teams in a game
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { gameId } = await params;

        const game = await Game.findById(gameId).lean();
        if (!game) {
            return NextResponse.json(
                { success: false, error: "Game not found" },
                { status: 404 }
            );
        }

        const league = await League.findById(game.league).select("organization").lean();
        if (!league) {
            return NextResponse.json(
                { success: false, error: "League not found" },
                { status: 404 }
            );
        }

        // By teamId (league-scoped name match for older games) — two
        // unrelated real teams can share a name across different leagues
        // (e.g. a "Warriors" in Chino and a different "Warriors" in
        // Temecula), and a name-only match could otherwise hand the
        // statistician the wrong team's roster.
        const { teamA, teamB } = await findGameTeamsWithPlayers(game, league.organization);

        // A player deactivated for this specific team (e.g. hasn't paid for
        // the new season) stays on the roster in the admin, but is omitted
        // here so the statistician's app never offers their jersey number at
        // all — see Team.players[].active.
        const activeEntries = (team) => (team?.players || [])
            .filter((p) => p.active !== false)
            .map((p) => ({
                playerId: p.player?._id || p.player,
                playerName: p.player?.name || "",
                playerPhoto: p.player?.photo || "",
                jerseyNumber: p.jerseyNumber,
            }));

        const roster = { teamA: activeEntries(teamA), teamB: activeEntries(teamB) };

        return NextResponse.json({ success: true, data: roster });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
