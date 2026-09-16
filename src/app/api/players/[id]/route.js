import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import GameStat from "@/models/GameStat";
import { requireAdmin } from "@/lib/apiAuth";
import { reconcilePlayerStatuses } from "@/lib/playerRosterSync";

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
        const { teamName, jerseyNumber, teams, ...playerUpdates } = body;
        let updateData = { ...playerUpdates };

        if (body.teams !== undefined) {
            // New parallel assignment logic
            const TeamModel = require("@/models/Team").default || require("mongoose").models.Team;
            
            const currentTeams = await TeamModel.find({ "players.player": id });
            const currentTeamIds = new Set(currentTeams.map(t => String(t._id)));
            const nextTeamIds = new Set(body.teams.map(t => String(t.teamId)));

            // Validate every requested jersey number BEFORE writing anything.
            // This push used to go straight into Team.players unchecked — root
            // cause of the DARKSIDE/GOAT/Members Only/N&B/Suspects/Warfare
            // duplicate-jersey findings — unlike /api/teams, which has always
            // validated this on save. Checking all requests up front (instead
            // of mid-loop) avoids leaving a half-applied assignment if a later
            // team in the list turns out to conflict.
            for (const tReq of body.teams) {
                const jNum = tReq.jerseyNumber != null && tReq.jerseyNumber !== "" ? Number(tReq.jerseyNumber) : 0;
                const targetTeam = await TeamModel.findById(tReq.teamId).select("name players").lean();
                if (!targetTeam) continue;
                // Only checked against ACTIVE teammates — a deactivated
                // player's old number is free to reassign (see
                // Team.players[].active and the same scoping in
                // PUT /api/teams/[id]).
                const duplicate = (targetTeam.players || []).find(
                    (p) => p.jerseyNumber === jNum && String(p.player) !== String(id) && p.active !== false
                );
                if (duplicate) {
                    return NextResponse.json(
                        { success: false, error: `Jersey number ${jNum} is already taken on team "${targetTeam.name}"` },
                        { status: 409 }
                    );
                }
            }

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
                updateData.status = "free_agent";
                updateData.presentTeam = { name: "", logo: "" };
            }

            // Delete stats for teams flagged by the organizer (wrong assignment or season change)
            if (body.deleteStatsFor?.length > 0) {
                await GameStat.deleteMany({ player: id, teamName: { $in: body.deleteStatsFor } });
            }
        } else if (teamName !== undefined || jerseyNumber !== undefined) {
            const TeamModel = require("@/models/Team").default || require("mongoose").models.Team;

            // Resolve + validate the target team BEFORE touching any roster —
            // same duplicate-jersey gap as the body.teams branch above, just
            // in this endpoint's older single-team assignment path.
            let newTeam = null;
            if (teamName && teamName.trim() !== "") {
                newTeam = await TeamModel.findOne({ name: teamName }).select("name logo players");
                if (newTeam) {
                    const jNum = jerseyNumber != null && jerseyNumber !== "" ? Number(jerseyNumber) : 0;
                    // Only checked against ACTIVE teammates — see the
                    // body.teams branch above for why.
                    const duplicate = (newTeam.players || []).find(
                        (p) => p.jerseyNumber === jNum && String(p.player) !== String(id) && p.active !== false
                    );
                    if (duplicate) {
                        return NextResponse.json(
                            { success: false, error: `Jersey number ${jNum} is already taken on team "${newTeam.name}"` },
                            { status: 409 }
                        );
                    }
                }
            }

            // 1. Remove player from any team they are currently attached to
            await TeamModel.updateMany(
                { "players.player": id },
                { $pull: { players: { player: id } } }
            );

            // 2. Add player to the new team with the provided jerseyNumber
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
        }

        const player = await Player.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
        if (!player) {
            return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 });
        }

        // Deactivating/reactivating a player globally (the Active/Inactive
        // toggle on /admin/players) cascades into every team roster they're
        // currently on — Team.players[].active is the field actually
        // enforced at stat-recording time (see GET .../roster and POST/PUT
        // .../plays), so without this a global "deactivate" would just gray
        // out a badge here without stopping anything in the stats app.
        let reactivationWarning;
        if (body.isActive === false) {
            // Deactivating never conflicts with anything — blind-overwrite
            // every membership.
            const TeamModel = require("@/models/Team").default || require("mongoose").models.Team;
            await TeamModel.updateMany(
                { "players.player": new mongoose.Types.ObjectId(id) },
                { $set: { "players.$[elem].active": false } },
                { arrayFilters: [{ "elem.player": new mongoose.Types.ObjectId(id) }] }
            );
        } else if (body.isActive === true) {
            // Reactivating: a team where someone else picked up this
            // player's old jersey number while they were inactive (see
            // PUT /api/teams/[id]'s active-only duplicate check) can't just
            // be force-overwritten — that would silently create two active
            // players sharing one number. Reactivate everywhere it's safe,
            // and report back exactly which teams still need the organizer
            // to resolve the conflict by hand (from that team's Manage
            // Players modal, which walks them through it).
            const TeamModel = require("@/models/Team").default || require("mongoose").models.Team;
            const teams = await TeamModel.find({ "players.player": id }).select("name players").lean();
            const conflicts = [];
            for (const team of teams) {
                const mine = (team.players || []).find((p) => String(p.player) === String(id));
                if (!mine) continue;
                const conflictEntry = (team.players || []).find(
                    (p) => String(p.player) !== String(id) && p.jerseyNumber === mine.jerseyNumber && p.active !== false
                );
                if (conflictEntry) {
                    conflicts.push({ teamName: team.name, jerseyNumber: mine.jerseyNumber, conflictPlayerId: conflictEntry.player });
                } else {
                    await TeamModel.updateOne(
                        { _id: team._id, "players.player": id },
                        { $set: { "players.$.active": true } }
                    );
                }
            }
            if (conflicts.length > 0) {
                const conflictPlayers = await Player.find({ _id: { $in: conflicts.map((c) => c.conflictPlayerId) } })
                    .select("name").lean();
                const nameById = new Map(conflictPlayers.map((p) => [String(p._id), p.name]));
                reactivationWarning = `Reactivated everywhere except: ${conflicts
                    .map((c) => `${c.teamName} (#${c.jerseyNumber} now worn by ${nameById.get(String(c.conflictPlayerId)) || "another player"})`)
                    .join(", ")}. Resolve the jersey number conflict from each team's Manage Players page.`;
            }
        }

        // Defense-in-depth: re-check this player's status against actual
        // roster membership, in case a concurrent edit raced with this one.
        if (body.teams !== undefined || teamName !== undefined || jerseyNumber !== undefined) {
            await reconcilePlayerStatuses([id]);
        }

        // Keep associated User record in sync if name was updated
        if (updateData.name && player.user) {
            const UserModel = require("@/models/User").default || require("mongoose").models.User;
            await UserModel.findByIdAndUpdate(
                player.user,
                { $set: { name: updateData.name } }
            );
        }

        return NextResponse.json(
            { success: true, data: player, ...(reactivationWarning ? { warning: reactivationWarning } : {}) },
            { status: 200 }
        );
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
