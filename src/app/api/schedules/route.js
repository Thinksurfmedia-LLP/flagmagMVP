import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Schedule from "@/models/Schedule";
import Organization from "@/models/Organization";
import User from "@/models/User";
import { requireAnyPermission } from "@/lib/apiAuth";
import { logActivity } from "@/lib/activityLogger";
import Game from "@/models/Game";
import Team from "@/models/Team";

// GET all schedules
export async function GET(request) {
    try {
        const auth = await requireAnyPermission([
            "manage_schedules", "schedule_view", "schedule_create", "schedule_update", "schedule_delete",
        ]);
        if (!auth.authorized) return auth.response;

        await dbConnect();

        const { searchParams } = new URL(request.url);
        const orgId = searchParams.get("organization");
        const search = searchParams.get("search");

        const filter = {};

        if (auth.user.role === "admin") {
            if (orgId) filter.organization = orgId;
        } else {
            const currentUser = await User.findById(auth.user.id).select("organization roleOrganizations").lean();
            const directOrg = currentUser?.organization ? String(currentUser.organization) : null;
            const roleOrgValues = Object.values(currentUser?.roleOrganizations || {})
                .flatMap(v => Array.isArray(v) ? v : [v])
                .map(String);
            const userOrgIds = [...new Set([directOrg, ...roleOrgValues].filter(Boolean))];
            if (!userOrgIds.length) {
                return NextResponse.json({ success: true, data: [] });
            }
            filter.organization = { $in: userOrgIds };
        }

        if (search) {
            filter.$or = [
                { scheduleLabel: { $regex: search, $options: "i" } },
                { locationName: { $regex: search, $options: "i" } },
            ];
        }

        const schedules = await Schedule.find(filter)
            .populate("organization", "name slug")
            .populate("leagueId", "name image")
            .populate("locationId", "name address")
            .populate("weeks.games.team1", "name logo")
            .populate("weeks.games.team2", "name logo")
            .sort({ createdAt: -1 })
            .lean();

        return NextResponse.json({ success: true, data: schedules });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST create a schedule
export async function POST(request) {
    try {
        const auth = await requireAnyPermission(["manage_schedules", "schedule_create"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const body = await request.json();

        if (!body.scheduleLabel || !body.scheduleLabel.trim()) {
            return NextResponse.json({ success: false, error: "Schedule label is required" }, { status: 400 });
        }

        if (!body.locationName || !body.locationName.trim()) {
            return NextResponse.json({ success: false, error: "Location name is required" }, { status: 400 });
        }

        if (!body.organization) {
            return NextResponse.json({ success: false, error: "Organization is required" }, { status: 400 });
        }

        const organization = await Organization.findById(body.organization);
        if (!organization) {
            return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
        }

        // Organizers can only create schedules for their own org
        if (auth.user.role !== "admin") {
            const currentUser = await User.findById(auth.user.id).select("organization roleOrganizations").lean();
            const directOrg = currentUser?.organization ? String(currentUser.organization) : null;
            const roleOrgValues = Object.values(currentUser?.roleOrganizations || {})
                .flatMap(v => Array.isArray(v) ? v : [v])
                .map(String);
            const userOrgIds = [...new Set([directOrg, ...roleOrgValues].filter(Boolean))];
            if (!userOrgIds.includes(String(organization._id))) {
                return NextResponse.json(
                    { success: false, error: "You can only create schedules for your assigned organization" },
                    { status: 403 },
                );
            }
        }

        const payload = {
            organization: organization._id,
            scheduleLabel: body.scheduleLabel.trim(),
            locationName: body.locationName.trim(),
            status: body.status || "Active",
        };

        if (body.leagueId) payload.leagueId = body.leagueId;
        if (body.locationId) payload.locationId = body.locationId;
        
        if (body.weeks && Array.isArray(body.weeks)) {
            // Pre-fetch all referenced teams to get their names and logos for the Game collection
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

            payload.weeks = [];
            for (const week of body.weeks) {
                const gamesData = [];
                if (Array.isArray(week.games)) {
                    for (const game of week.games) {
                        if (!game.team1 || !game.team2 || !game.date) continue; // Skip incomplete games

                        const t1 = teamMap[String(game.team1)];
                        const t2 = teamMap[String(game.team2)];
                        
                        if (!t1 || !t2) continue; // Safety check

                        // Compose location string for the Game model
                        const composedLocation = game.field ? `${payload.locationName} - ${game.field}` : payload.locationName;

                        // Create the standalone Game document
                        const newGame = await Game.create({
                            league: payload.leagueId,
                            date: new Date(game.date),
                            time: game.time || "",
                            teamA: { name: t1.name, logo: t1.logo || "", score: null },
                            teamB: { name: t2.name, logo: t2.logo || "", score: null },
                            location: composedLocation,
                            status: "upcoming",
                            gameType: game.gameType || "main"
                        });

                        gamesData.push({
                            team1: game.team1,
                            team2: game.team2,
                            field: game.field || "",
                            date: game.date,
                            time: game.time || "",
                            gameType: game.gameType || "main",
                            gameRef: newGame._id
                        });
                    }
                }
                payload.weeks.push({
                    name: week.name || "",
                    games: gamesData
                });
            }
        }

        const schedule = await Schedule.create(payload);

        await logActivity({
            userId: auth.user.id,
            role: auth.user.role || auth.user.roles?.[0] || "unknown",
            action: "CREATED_SCHEDULE",
            details: `Created new schedule ${schedule.scheduleLabel} for organization ${organization.name}`,
            organization: organization._id
        });

        return NextResponse.json({ success: true, data: schedule }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
