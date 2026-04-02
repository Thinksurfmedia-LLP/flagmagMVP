import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import { requireAdmin } from "@/lib/apiAuth";

// GET single player
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { id } = await params;
        const player = await Player.findById(id).lean();

        if (!player) {
            return NextResponse.json(
                { success: false, error: "Player not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: player }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// UPDATE player (admin/organizer only)
export async function PUT(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const body = await request.json();

        // Handle Team changes explicitly
        const { teamName, jerseyNumber, ...playerUpdates } = body;
        let updateData = { ...playerUpdates };

        if (teamName !== undefined || jerseyNumber !== undefined) {
            const TeamModel = require("@/models/Team").default || require("mongoose").models.Team;
            
            // 1. Remove player from any team they are currently attached to
            await TeamModel.updateMany(
                { "players.player": id },
                { $pull: { players: { player: id } } }
            );

            // 2. Add player to the new team with the provided jerseyNumber
            if (teamName && teamName.trim() !== "") {
                const newTeam = await TeamModel.findOne({ name: teamName });
                if (newTeam) {
                    const jNum = jerseyNumber != null && jerseyNumber !== "" ? Number(jerseyNumber) : 0;
                    await TeamModel.findByIdAndUpdate(newTeam._id, {
                        $push: { players: { player: id, jerseyNumber: jNum } }
                    });
                    updateData.presentTeam = { name: newTeam.name, logo: newTeam.logo || "" };
                    
                    // If player was a free_agent but now assigned to a team, make sure they are active as 'player'
                    updateData.status = "player"; 
                } else {
                    updateData.presentTeam = { name: "", logo: "" };
                }
            } else {
                updateData.presentTeam = { name: "", logo: "" };
            }
        }

        const player = await Player.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
        if (!player) {
            return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: player }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE player (admin/organizer only)
export async function DELETE(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const player = await Player.findByIdAndDelete(id);
        if (!player) {
            return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, message: "Player deleted" }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
