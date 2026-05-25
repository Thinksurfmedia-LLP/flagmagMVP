import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Game from "@/models/Game";
import Team from "@/models/Team";
import League from "@/models/League";
import Schedule from "@/models/Schedule";
import { requireAnyPermission } from "@/lib/apiAuth";

// GET games for a season
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const date = searchParams.get("date");

        const weekStart = searchParams.get("weekStart");

        const filter = { league: id, gameType: { $ne: "practice" } };
        if (status) filter.status = status;
        if (weekStart) {
            const start = new Date(weekStart);
            const end = new Date(weekStart);
            end.setUTCDate(end.getUTCDate() + 7);
            filter.date = { $gte: start, $lt: end };
        } else if (date) {
            const d = new Date(date);
            filter.date = {
                $gte: new Date(d.setHours(0, 0, 0, 0)),
                $lt: new Date(d.setHours(23, 59, 59, 999)),
            };
        }

        const games = await Game.find(filter).sort({ date: 1, time: 1 }).lean();

        // Populate latest team logos and details from the Team model
        const league = await League.findById(id).lean();
        if (league && league.organization) {
            const teams = await Team.find({ organization: league.organization }).lean();
            const teamMap = {};
            teams.forEach((t) => {
                teamMap[t.name] = t;
            });

            games.forEach((game) => {
                const teamAData = teamMap[game.teamA?.name];
                if (teamAData) {
                    game.teamA.logo = teamAData.logo || game.teamA.logo;
                    game.teamA.details = teamAData;
                }

                const teamBData = teamMap[game.teamB?.name];
                if (teamBData) {
                    game.teamB.logo = teamBData.logo || game.teamB.logo;
                    game.teamB.details = teamBData;
                }
            });
        }

        return NextResponse.json(
            { success: true, count: games.length, data: games },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// CREATE game in a season (admin/organizer/statistician with game_create)
export async function POST(request, { params }) {
    try {
        const auth = await requireAnyPermission(["manage_games", "game_create"]);
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const body = await request.json();
        body.league = id;

        // Validate against league start date
        if (body.date) {
            const league = await League.findById(id).select("startDate name").lean();
            if (league?.startDate) {
                const gameDate = new Date(body.date);
                const startDate = new Date(league.startDate);
                gameDate.setHours(0, 0, 0, 0);
                startDate.setHours(0, 0, 0, 0);
                if (gameDate < startDate) {
                    return NextResponse.json(
                        { success: false, error: `Game date cannot be before the league start date (${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})` },
                        { status: 400 }
                    );
                }
            }
        }

        const game = await Game.create(body);

        // Sync into a Schedule document so the game appears on the website schedules page
        try {
            const league = await League.findById(id).select("name organization").lean();
            if (league) {
                // Resolve team ObjectIds by name within the org
                const teamNames = [body.teamA?.name, body.teamB?.name].filter(Boolean);
                const teams = teamNames.length
                    ? await Team.find({ organization: league.organization, name: { $in: teamNames } }).select("_id name").lean()
                    : [];
                const teamByName = {};
                teams.forEach((t) => { teamByName[t.name] = t._id; });

                // Derive location / field from composed location string
                const dashIdx = (body.location || "").indexOf(" - ");
                const locationName = dashIdx > -1 ? body.location.slice(0, dashIdx) : (body.location || "");
                const fieldName = dashIdx > -1 ? body.location.slice(dashIdx + 3) : "";

                // Week label derived from game date (week starting Sunday)
                const gameDate = new Date(body.date);
                const weekStart = new Date(gameDate);
                weekStart.setUTCDate(gameDate.getUTCDate() - gameDate.getUTCDay());
                const weekLabel = `Week of ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

                const dateStr = typeof body.date === "string"
                    ? body.date.split("T")[0]
                    : new Date(body.date).toISOString().split("T")[0];

                const gameEntry = {
                    team1: teamByName[body.teamA?.name] || null,
                    team2: teamByName[body.teamB?.name] || null,
                    field: fieldName,
                    date: dateStr,
                    time: body.time || "",
                    gameType: body.gameType || "main",
                    gameRef: game._id,
                };

                // Find an existing schedule for this league or create one
                const existing = await Schedule.findOne({ leagueId: id }).select("_id weeks").lean();
                if (!existing) {
                    await Schedule.create({
                        organization: league.organization,
                        scheduleLabel: league.name,
                        locationName: locationName || "TBD",
                        leagueId: id,
                        status: "Active",
                        weeks: [{ name: weekLabel, games: [gameEntry] }],
                    });
                } else {
                    const weekIdx = (existing.weeks || []).findIndex((w) => w.name === weekLabel);
                    if (weekIdx >= 0) {
                        await Schedule.updateOne(
                            { _id: existing._id },
                            { $push: { [`weeks.${weekIdx}.games`]: gameEntry } }
                        );
                    } else {
                        await Schedule.updateOne(
                            { _id: existing._id },
                            { $push: { weeks: { name: weekLabel, games: [gameEntry] } } }
                        );
                    }
                }
            }
        } catch (scheduleErr) {
            console.error("Schedule sync failed:", scheduleErr);
        }

        return NextResponse.json({ success: true, data: game }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
