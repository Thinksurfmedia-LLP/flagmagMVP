import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";

export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const team = searchParams.get("team") || "";
        const statType = searchParams.get("statType") || "passing";

        // Fetch all players; filter by team if the player's presentTeam matches
        let query = {};
        if (team) {
            query["presentTeam.name"] = { $regex: new RegExp(`^${team}$`, "i") };
        }

        const players = await Player.find(query).lean();

        // Map players to stat rows based on statType
        const rows = players.map((p) => {
            // Since there's no dedicated stats model yet, we use placeholder stat values
            // These would be replaced with real per-game stats when the model exists
            let stats = {};
            if (statType === "passing") {
                stats = { rate: "102.08", atts: 12, comp: 102, tds: 10, pct: 60, xp2: "-", yards: 1, ten: 114, twenty: 2, forty: 22, ints: 50, intOpen: 25, intXp: 25 };
            } else if (statType === "rushing") {
                stats = { rate: "88.50", atts: 18, comp: 85, tds: 6, pct: 47, xp2: "2", yards: 156, ten: 8, twenty: 3, forty: 1, ints: 0, intOpen: 0, intXp: 0 };
            } else if (statType === "receiving") {
                stats = { rate: "95.20", atts: 22, comp: 95, tds: 8, pct: 55, xp2: "1", yards: 210, ten: 12, twenty: 5, forty: 2, ints: 0, intOpen: 0, intXp: 0 };
            }

            return {
                _id: p._id.toString(),
                name: p.name,
                photo: p.photo || "/assets/images/t-logo.jpg",
                teamLogo: p.presentTeam?.logo || "/assets/images/t-logo.jpg",
                teamName: p.presentTeam?.name || "",
                ...stats,
            };
        });

        return NextResponse.json({ players: rows });
    } catch (error) {
        console.error("Error fetching player stats:", error);
        return NextResponse.json({ error: "Failed to fetch player stats" }, { status: 500 });
    }
}
