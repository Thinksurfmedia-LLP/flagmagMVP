import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import GameStat from "@/models/GameStat";
import { requireAdmin } from "@/lib/apiAuth";
import { reconcilePlayerStatuses } from "@/lib/playerRosterSync";
import {
    validateTeamJerseyRequests,
    pushPlayerAtomic,
    renumberPlayerAtomic,
    reactivatePlayerAtomic,
    inTransaction,
    RosterConflictError,
} from "@/lib/teamJerseyGuard";
import { deletePlayer } from "@/lib/playerDeletion";

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
            
            const nextTeamIds = new Set(body.teams.map(t => String(t.teamId)));

            // Validate every requested jersey number BEFORE writing anything.
            // This push used to go straight into Team.players unchecked — root
            // cause of the DARKSIDE/GOAT/Members Only/N&B/Suspects/Warfare
            // duplicate-jersey findings — unlike /api/teams, which has always
            // validated this on save. Checking all requests up front (instead
            // of mid-loop) avoids leaving a half-applied assignment if a later
            // team in the list turns out to conflict.
            // Duplicates are only checked against ACTIVE teammates (a
            // deactivated player's old number is free to reassign), and a
            // team where this player keeps their existing number is skipped
            // so a legacy duplicate doesn't block editing their profile.
            const jerseyCheck = await validateTeamJerseyRequests(TeamModel, body.teams, id);
            if (!jerseyCheck.ok) {
                return NextResponse.json({ success: false, error: jerseyCheck.error }, { status: jerseyCheck.status });
            }

            // All roster writes in one transaction, each an atomic
            // check-and-write (see teamJerseyGuard.js) — if another request
            // took a number between the validation above and here, the whole
            // assignment rolls back with a 409 instead of saving a duplicate
            // or leaving it half-applied.
            const latestTeam = await inTransaction(async (session) => {
                // Re-read membership inside the transaction — the snapshot
                // above is only for validation messages; deciding push vs
                // renumber from it could misfire if this player's rosters
                // changed in between.
                const liveTeams = await TeamModel.find({ "players.player": id }).select("name players").session(session).lean();
                const currentById = new Map(liveTeams.map((t) => [String(t._id), t]));
                for (const t of liveTeams) {
                    if (!nextTeamIds.has(String(t._id))) {
                        await TeamModel.updateOne(
                            { _id: t._id },
                            { $pull: { players: { player: id } }, $inc: { __v: 1 } },
                            { session }
                        );
                    }
                }

                let first = null;
                for (const tReq of body.teams) {
                    const jNum = jerseyCheck.numbers.get(String(tReq.teamId));
                    if (jNum === undefined) continue; // team no longer exists
                    const current = currentById.get(String(tReq.teamId));
                    const teamName = current?.name || tReq.teamName || "this team";
                    if (current) {
                        const mine = current.players.find((p) => String(p.player) === String(id));
                        if (mine?.jerseyNumber !== jNum) {
                            await renumberPlayerAtomic(TeamModel, { teamId: tReq.teamId, teamName, playerId: id, jerseyNumber: jNum, session });
                        }
                    } else {
                        await pushPlayerAtomic(TeamModel, { teamId: tReq.teamId, teamName, playerId: id, jerseyNumber: jNum, session });
                    }
                    if (!first) first = await TeamModel.findById(tReq.teamId).select("name logo").session(session).lean();
                }
                return first;
            });
            
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
            // Older single-team path ({ teamName, jerseyNumber }): moves the
            // player off every team and onto one. No admin screen sends this
            // shape any more (they all send `teams`), but it's still reachable
            // by API, so it gets the same rules as the `teams` branch: number
            // required (blank used to silently become #0), unique among
            // active teammates, not retired, written atomically.
            const TeamModel = require("@/models/Team").default || require("mongoose").models.Team;

            let newTeam = null;
            let jNum;
            if (teamName && teamName.trim() !== "") {
                newTeam = await TeamModel.findOne({ name: teamName }).select("name logo").lean();
                if (!newTeam) {
                    // Used to silently unassign the player from every team.
                    return NextResponse.json({ success: false, error: `Team "${teamName}" not found` }, { status: 404 });
                }
                const jerseyCheck = await validateTeamJerseyRequests(TeamModel, [{ teamId: newTeam._id, jerseyNumber }], id);
                if (!jerseyCheck.ok) {
                    return NextResponse.json({ success: false, error: jerseyCheck.error }, { status: jerseyCheck.status });
                }
                jNum = jerseyCheck.numbers.get(String(newTeam._id));
            }

            await inTransaction(async (session) => {
                // 1. Remove player from any team they are currently attached to
                await TeamModel.updateMany(
                    { "players.player": id },
                    { $pull: { players: { player: id } }, $inc: { __v: 1 } },
                    { session }
                );
                // 2. Add player to the new team — atomic, rolls back step 1 on conflict
                if (newTeam) {
                    await pushPlayerAtomic(TeamModel, { teamId: newTeam._id, teamName: newTeam.name, playerId: id, jerseyNumber: jNum, session });
                }
            });

            if (newTeam) {
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
            // $inc __v so an open Manage Players modal can't overwrite this
            // with its stale copy (see teamJerseyGuard.js).
            await TeamModel.updateMany(
                { "players.player": new mongoose.Types.ObjectId(id) },
                { $set: { "players.$[elem].active": false }, $inc: { __v: 1 } },
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
                // Atomic: only flips to active if nobody else wears the
                // number at write time, so a racing assignment can't slip in
                // between this check and the write.
                const reactivated = await reactivatePlayerAtomic(TeamModel, { teamId: team._id, playerId: id, jerseyNumber: mine.jerseyNumber });
                if (!reactivated) {
                    const fresh = await TeamModel.findById(team._id).select("players").lean();
                    const conflictEntry = (fresh?.players || []).find(
                        (p) => String(p.player) !== String(id) && p.jerseyNumber === mine.jerseyNumber && p.active !== false
                    );
                    conflicts.push({ teamName: team.name, jerseyNumber: mine.jerseyNumber, conflictPlayerId: conflictEntry?.player });
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
        if (error instanceof RosterConflictError) {
            return NextResponse.json({ success: false, code: "ROSTER_CONFLICT", error: error.message }, { status: 409 });
        }
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
        // Also clears rosters/retired reservations and syncs the linked
        // user's role — and refuses if the player has recorded history.
        const result = await deletePlayer(id);
        if (!result.ok) {
            return NextResponse.json({ success: false, error: result.error }, { status: result.status });
        }
        return NextResponse.json({ success: true, message: "Player deleted" }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
