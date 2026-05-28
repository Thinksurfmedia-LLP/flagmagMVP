import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Schedule from "@/models/Schedule";
import User from "@/models/User";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";
import { logActivity } from "@/lib/activityLogger";
import Game from "@/models/Game";
import Team from "@/models/Team";

// GET single schedule
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { id } = await params;
        const schedule = await Schedule.findById(id)
            .populate("organization", "name slug logo")
            .populate("leagueId", "name image")
            .populate("locationId", "name address")
            .populate("weeks.games.team1", "name logo")
            .populate("weeks.games.team2", "name logo")
            .lean();

        if (!schedule) {
            return NextResponse.json(
                { success: false, error: "Schedule not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { success: true, data: schedule },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// UPDATE schedule
export async function PUT(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_schedules", "schedule_update"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const body = await request.json();

        const existingSchedule = await Schedule.findById(id).select("organization scheduleLabel locationName weeks leagueId").lean();
        if (!existingSchedule) {
            return NextResponse.json(
                { success: false, error: "Schedule not found" },
                { status: 404 }
            );
        }

        if (hasRole(auth.user, "organizer")) {
            const currentUser = await User.findById(auth.user.id).select("organization roleOrganizations").lean();
            const directOrg = currentUser?.organization ? String(currentUser.organization) : null;
            const roleOrgValues = Object.values(currentUser?.roleOrganizations || {})
                .flatMap(v => Array.isArray(v) ? v : [v])
                .map(String);
            const userOrgIds = [...new Set([directOrg, ...roleOrgValues].filter(Boolean))];
            if (!userOrgIds.includes(String(existingSchedule.organization))) {
                return NextResponse.json(
                    { success: false, error: "You can only update schedules for your assigned organization" },
                    { status: 403 }
                );
            }
        }

        const updates = {};
        if (body.scheduleLabel !== undefined) updates.scheduleLabel = body.scheduleLabel;
        if (body.locationName !== undefined) updates.locationName = body.locationName;
        if (body.status !== undefined) updates.status = body.status;
        if (body.leagueId !== undefined) updates.leagueId = body.leagueId;
        if (body.locationId !== undefined) updates.locationId = body.locationId;
        
        const locName = body.locationName || existingSchedule.locationName;
        const lgId = body.leagueId || existingSchedule.leagueId;

        if (body.weeks && Array.isArray(body.weeks)) {
            // Pre-fetch all referenced teams
            const teamIds = [];
            body.weeks.forEach(w => {
                if (Array.isArray(w.games)) {
                    w.games.forEach(g => {
                        if (g.team1) teamIds.push(g.team1);
                        if (g.team2) teamIds.push(g.team2);
                    });
                }
            });
            const uniqueTeamIds = [...new Set(teamIds.filter(Boolean))];
            const teams = await Team.find({ _id: { $in: uniqueTeamIds } }).lean();
            const teamMap = {};
            teams.forEach(t => { teamMap[String(t._id)] = t; });

            // Extract all previous gameRefs
            const prevGameRefs = new Set();
            if (existingSchedule.weeks) {
                existingSchedule.weeks.forEach(w => {
                    w.games?.forEach(g => {
                        if (g.gameRef) prevGameRefs.add(String(g.gameRef));
                    });
                });
            }

            const currentGamesRefs = new Set();
            const newWeeks = [];

            for (const week of body.weeks) {
                const gamesData = [];
                if (Array.isArray(week.games)) {
                    for (const game of week.games) {
                        if (!game.team1 || !game.team2 || !game.date) continue; // Skip incomplete games

                        const t1 = teamMap[String(game.team1)];
                        const t2 = teamMap[String(game.team2)];
                        
                        if (!t1 || !t2) continue; // Safety check

                        const composedLocation = game.field ? `${locName} - ${game.field}` : locName;

                        let gameRef = game.gameRef || null;

                        if (gameRef && prevGameRefs.has(String(gameRef))) {
                            // Update existing game — preserve scores, only update structural fields
                            await Game.findByIdAndUpdate(gameRef, {
                                league: lgId,
                                date: new Date(game.date),
                                time: game.time || "",
                                "teamA.name": t1.name,
                                "teamA.logo": t1.logo || "",
                                "teamB.name": t2.name,
                                "teamB.logo": t2.logo || "",
                                location: composedLocation,
                                gameType: game.gameType || "main"
                            });
                        } else {
                            // Create new game
                            const newGame = await Game.create({
                                league: lgId,
                                date: new Date(game.date),
                                time: game.time || "",
                                teamA: { name: t1.name, logo: t1.logo || "", score: null },
                                teamB: { name: t2.name, logo: t2.logo || "", score: null },
                                location: composedLocation,
                                status: "upcoming",
                                gameType: game.gameType || "main"
                            });
                            gameRef = newGame._id;
                        }

                        if (gameRef) currentGamesRefs.add(String(gameRef));

                        gamesData.push({
                            team1: game.team1,
                            team2: game.team2,
                            field: game.field || "",
                            date: game.date,
                            time: game.time || "",
                            gameType: game.gameType || "main",
                            gameRef: gameRef
                        });
                    }
                }
                newWeeks.push({
                    name: week.name || "",
                    games: gamesData
                });
            }
            updates.weeks = newWeeks;

            // Delete orphaned games
            const orphanedRefs = [...prevGameRefs].filter(ref => !currentGamesRefs.has(ref));
            if (orphanedRefs.length > 0) {
                await Game.deleteMany({ _id: { $in: orphanedRefs } });
            }
        }

        const schedule = await Schedule.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
        if (!schedule) {
            return NextResponse.json(
                { success: false, error: "Schedule not found" },
                { status: 404 }
            );
        }

        await logActivity({
            userId: auth.user.id,
            role: auth.user.role || auth.user.roles?.[0] || "unknown",
            action: "UPDATED_SCHEDULE",
            details: `Updated schedule '${schedule.scheduleLabel}'`,
            organization: schedule.organization
        });

        return NextResponse.json({ success: true, data: schedule }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE schedule
export async function DELETE(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_schedules", "schedule_delete"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const schedule = await Schedule.findById(id).select("organization scheduleLabel weeks");

        if (!schedule) {
            return NextResponse.json(
                { success: false, error: "Schedule not found" },
                { status: 404 }
            );
        }

        if (hasRole(auth.user, "organizer")) {
            const currentUser = await User.findById(auth.user.id).select("organization roleOrganizations").lean();
            const directOrg = currentUser?.organization ? String(currentUser.organization) : null;
            const roleOrgValues = Object.values(currentUser?.roleOrganizations || {})
                .flatMap(v => Array.isArray(v) ? v : [v])
                .map(String);
            const userOrgIds = [...new Set([directOrg, ...roleOrgValues].filter(Boolean))];
            if (!userOrgIds.includes(String(schedule.organization))) {
                return NextResponse.json(
                    { success: false, error: "You can only delete schedules for your assigned organization" },
                    { status: 403 }
                );
            }
        }

        // Collect all linked Game IDs and delete them
        const gameRefs = [];
        if (schedule.weeks) {
            schedule.weeks.forEach(w => {
                w.games?.forEach(g => {
                    if (g.gameRef) gameRefs.push(g.gameRef);
                });
            });
        }
        if (gameRefs.length > 0) {
            await Game.deleteMany({ _id: { $in: gameRefs } });
        }

        await Schedule.deleteOne({ _id: id });

        await logActivity({
            userId: auth.user.id,
            role: auth.user.role || auth.user.roles?.[0] || "unknown",
            action: "DELETED_SCHEDULE",
            details: `Deleted schedule '${schedule.scheduleLabel}'`,
            organization: schedule.organization
        });

        return NextResponse.json({ success: true, message: "Schedule deleted" }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
