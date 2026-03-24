import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Game from "@/models/Game";
import League from "@/models/League";
import Team from "@/models/Team";

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

        const teams = await Team.find({
            organization: league.organization,
            name: { $in: [game.teamA.name, game.teamB.name] },
        })
            .populate("players.player", "name photo")
            .lean();

        const roster = { teamA: [], teamB: [] };
        for (const team of teams) {
            const entries = (team.players || []).map((p) => ({
                playerId: p.player?._id || p.player,
                playerName: p.player?.name || "",
                playerPhoto: p.player?.photo || "",
                jerseyNumber: p.jerseyNumber,
            }));

            if (team.name === game.teamA.name) {
                roster.teamA = entries;
            } else if (team.name === game.teamB.name) {
                roster.teamB = entries;
            }
        }

        return NextResponse.json({ success: true, data: roster });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
