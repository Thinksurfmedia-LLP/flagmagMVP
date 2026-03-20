import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import GameStat from "@/models/GameStat";

export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { gameId } = await params;
        const { searchParams } = new URL(request.url);
        const team = searchParams.get("team") || "";
        const statType = searchParams.get("statType") || "passing";

        const filter = { game: gameId, statType };
        if (team) {
            filter.teamName = { $regex: new RegExp(`^${team}$`, "i") };
        }

        const stats = await GameStat.find(filter)
            .populate("player", "name photo presentTeam")
            .lean();

        const rows = stats.map((s) => ({
            _id: s.player?._id?.toString() || s._id.toString(),
            name: s.player?.name || "Unknown",
            photo: s.player?.photo || "/assets/images/t-logo.jpg",
            teamLogo: s.player?.presentTeam?.logo || "/assets/images/t-logo.jpg",
            teamName: s.teamName || s.player?.presentTeam?.name || "",
            rate: s.rate,
            atts: s.atts,
            comp: s.comp,
            tds: s.tds,
            pct: s.pct,
            xp2: s.xp2,
            yards: s.yards,
            ten: s.ten,
            twenty: s.twenty,
            forty: s.forty,
            ints: s.ints,
            intOpen: s.intOpen,
            intXp: s.intXp,
        }));

        return NextResponse.json({ players: rows });
    } catch (error) {
        console.error("Error fetching player stats:", error);
        return NextResponse.json({ error: "Failed to fetch player stats" }, { status: 500 });
    }
}
