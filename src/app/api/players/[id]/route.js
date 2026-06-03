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

        if (body.teams !== undefined) {
            // New parallel assignment logic
            const TeamModel = require("@/models/Team").default || require("mongoose").models.Team;
            
            const currentTeams = await TeamModel.find({ "players.player": id });
            const currentTeamIds = new Set(currentTeams.map(t => String(t._id)));
            const nextTeamIds = new Set(body.teams.map(t => String(t.teamId)));
            
            // Remove from teams no longer in the list
            for (const t of currentTeams) {
                if (!nextTeamIds.has(String(t._id))) {
                    await TeamModel.findByIdAndUpdate(t._id, { $pull: { players: { player: id } } });
                }
            }
            
            // Add or update teams in the list
            let latestTeam = null;
            for (const tReq of body.teams) {
                const jNum = tReq.jerseyNumber != null && tReq.jerseyNumber !== "" ? Number(tReq.jerseyNumber) : 0;
                if (currentTeamIds.has(String(tReq.teamId))) {
                    await TeamModel.updateOne({ _id: tReq.teamId, "players.player": id }, { $set: { "players.$.jerseyNumber": jNum } });
                    if (!latestTeam) latestTeam = await TeamModel.findById(tReq.teamId);
                } else {
                    await TeamModel.findByIdAndUpdate(tReq.teamId, { $push: { players: { player: id, jerseyNumber: jNum } } });
                    if (!latestTeam) latestTeam = await TeamModel.findById(tReq.teamId);
                }
            }
            
            if (body.teams.length > 0) {
                updateData.status = "player";
                if (latestTeam) updateData.presentTeam = { name: latestTeam.name, logo: latestTeam.logo || "" };
            } else {
                updateData.presentTeam = { name: "", logo: "" };
            }
        } else if (teamName !== undefined || jerseyNumber !== undefined) {
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

        // Keep associated User record in sync if name was updated
        if (updateData.name && player.user) {
            const UserModel = require("@/models/User").default || require("mongoose").models.User;
            await UserModel.findByIdAndUpdate(
                player.user,
                { $set: { name: updateData.name } }
            );
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
