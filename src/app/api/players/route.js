import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import { requireAdmin } from "@/lib/apiAuth";

// GET all players
export async function GET(request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search");
        const status = searchParams.get("status");

        const filter = {};

        // Filter by status if provided; default shows all
        if (status) {
            filter.status = status;
        }

        if (search) {
            filter.name = { $regex: search, $options: "i" };
        }

        const players = await Player.find(filter)
            .populate("organization", "name slug")
            .sort({ name: 1 })
            .lean();

        // Extra: map jersey numbers from Team collection
        const playerIds = players.map(p => p._id);
        
        // Use dynamic import or direct require to prevent cycle issues or model missing errors, or we can just import Team at the top
        // But since we can't reliably know if Team is imported, let's just do mongoose.model("Team")
        const mongoose = require("mongoose");
        const TeamModel = mongoose.models.Team || require("@/models/Team").default;
        
        const teams = await TeamModel.find({ "players.player": { $in: playerIds } }).lean();
        const jerseyMap = {};
        for (const team of teams) {
             for (const p of (team.players || [])) {
                 if (p.player) jerseyMap[p.player.toString()] = p.jerseyNumber;
             }
        }
        
        players.forEach(p => {
             p.jerseyNumber = jerseyMap[p._id.toString()] || null;
        });

        return NextResponse.json({ success: true, count: players.length, data: players }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// CREATE player (admin/organizer only)
export async function POST(request) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const body = await request.json();
        const player = await Player.create(body);
        return NextResponse.json({ success: true, data: player }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
