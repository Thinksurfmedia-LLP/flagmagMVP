import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Schedule from "@/models/Schedule";
import User from "@/models/User";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";
import { logActivity } from "@/lib/activityLogger";
import Game from "@/models/Game";
import Play from "@/models/Play";
import GameStat from "@/models/GameStat";
import { inTransaction } from "@/lib/teamJerseyGuard";
import { collectGameRefs, hasGameHistory, describeGameHistory } from "@/lib/scheduleHistory";
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

        // Same dead-ref ambiguity as the list route: populate resolves a
        // dangling leagueId to null, indistinguishable from "never assigned".
        // Re-check the raw field so the edit page can show why League/Season
        // render blank instead of leaving it unexplained (see Denstar's
        // "Irvine Playoffs Summer 2026" schedule).
        const raw = await Schedule.findById(id).select("leagueId").lean();
        schedule.leagueRefBroken = Boolean(raw?.leagueId) && !schedule.leagueId;

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
                            const updated = await Game.findByIdAndUpdate(gameRef, {
                                league: lgId,
                                date: new Date(game.date),
                                time: game.time || "",
                                "teamA.teamId": t1._id,
                                "teamA.name": t1.name,
                                "teamA.logo": t1.logo || "",
                                "teamB.teamId": t2._id,
                                "teamB.name": t2.name,
                                "teamB.logo": t2.logo || "",
                                location: composedLocation,
                                gameType: game.gameType || "main",
                                sectionName: week.name || ""
                            });
                            if (!updated) {
                                // Game doc was deleted externally; recreate it
                                const newGame = await Game.create({
                                    league: lgId,
                                    date: new Date(game.date),
                                    time: game.time || "",
                                    teamA: { teamId: t1._id, name: t1.name, logo: t1.logo || "", score: null },
                                    teamB: { teamId: t2._id, name: t2.name, logo: t2.logo || "", score: null },
                                    location: composedLocation,
                                    status: "upcoming",
                                    gameType: game.gameType || "main",
                                    sectionName: week.name || ""
                                });
                                gameRef = newGame._id;
                            }
                        } else {
                            // Create new game
                            const newGame = await Game.create({
                                league: lgId,
                                date: new Date(game.date),
                                time: game.time || "",
                                teamA: { teamId: t1._id, name: t1.name, logo: t1.logo || "", score: null },
                                teamB: { teamId: t2._id, name: t2.name, logo: t2.logo || "", score: null },
                                location: composedLocation,
                                status: "upcoming",
                                gameType: game.gameType || "main",
                                sectionName: week.name || ""
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
// What a schedule delete would erase: games already played (or live) and any
// recorded plays, across every game the schedule links to.
async function countGameHistory(gameRefs) {
    if (gameRefs.length === 0) return { completedGames: 0, inProgressGames: 0, plays: 0 };
    const [completedGames, inProgressGames, plays] = await Promise.all([
        Game.countDocuments({ _id: { $in: gameRefs }, status: "completed" }),
        Game.countDocuments({ _id: { $in: gameRefs }, status: "in_progress" }),
        Play.countDocuments({ game: { $in: gameRefs } }),
    ]);
    return { completedGames, inProgressGames, plays };
}

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

        const gameRefs = collectGameRefs(schedule);

        // Deleting a schedule deletes its games, which erases any scores and
        // stats already recorded. Refuse unless the caller has seen exactly
        // what will be lost and confirmed it (the schedules page does this).
        const history = await countGameHistory(gameRefs);
        const confirmedHistory = new URL(request.url).searchParams.get("confirmDeleteHistory") === "true";
        if (hasGameHistory(history) && !confirmedHistory) {
            return NextResponse.json(
                {
                    success: false,
                    code: "HAS_GAME_HISTORY",
                    error: `"${schedule.scheduleLabel}" has ${describeGameHistory(history)}. Deleting it permanently erases them.`,
                    ...history,
                },
                { status: 409 }
            );
        }

        // Plays and stats go with their games (same as DELETE /api/games/[id])
        // — leaving them behind orphaned them and blocked deleting the players
        // involved. One transaction so a failure can't half-delete.
        await inTransaction(async (session) => {
            if (gameRefs.length > 0) {
                await Play.deleteMany({ game: { $in: gameRefs } }, { session });
                await GameStat.deleteMany({ game: { $in: gameRefs } }, { session });
                await Game.deleteMany({ _id: { $in: gameRefs } }, { session });
            }
            await Schedule.deleteOne({ _id: id }, { session });
        });

        await logActivity({
            userId: auth.user.id,
            role: auth.user.role || auth.user.roles?.[0] || "unknown",
            action: "DELETED_SCHEDULE",
            details: hasGameHistory(history)
                ? `Deleted schedule '${schedule.scheduleLabel}' including ${describeGameHistory(history)}`
                : `Deleted schedule '${schedule.scheduleLabel}'`,
            organization: schedule.organization
        });

        return NextResponse.json({ success: true, message: "Schedule deleted" }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
