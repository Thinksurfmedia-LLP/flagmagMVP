import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import GameStat from "@/models/GameStat";
import { requireAnyPermission } from "@/lib/apiAuth";

// GET stats for a game (public — needed by public frontend)
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { gameId } = await params;
        const { searchParams } = new URL(request.url);
        const teamName = searchParams.get("teamName");
        const statType = searchParams.get("statType");

        const filter = { game: gameId };
        if (teamName) filter.teamName = teamName;
        if (statType) filter.statType = statType;

        const stats = await GameStat.find(filter)
            .populate("player", "name photo presentTeam")
            .sort({ createdAt: 1 })
            .lean();

        return NextResponse.json({ success: true, data: stats });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// PUT — bulk upsert stats for a game (requires game_update permission)
export async function PUT(request, { params }) {
    const auth = await requireAnyPermission(["manage_games", "game_update"]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { gameId } = await params;
        const { teamName, statType, stats } = await request.json();

        if (!teamName || !statType || !Array.isArray(stats)) {
            return NextResponse.json(
                { success: false, error: "teamName, statType, and stats array are required" },
                { status: 400 }
            );
        }

        const statFields = [
            "rate", "atts", "comp", "tds", "pct", "xp2",
            "yards", "ten", "twenty", "forty", "ints", "intOpen", "intXp",
        ];

        let count = 0;
        for (const entry of stats) {
            if (!entry.player) continue;

            const update = { teamName, statType };
            for (const field of statFields) {
                update[field] = Number(entry[field]) || 0;
            }

            await GameStat.findOneAndUpdate(
                { game: gameId, player: entry.player, statType },
                { $set: update },
                { upsert: true, new: true }
            );
            count++;
        }

        return NextResponse.json({ success: true, count });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
