import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Game from "@/models/Game";
import Team from "@/models/Team";
import League from "@/models/League";
import { requireAdmin } from "@/lib/apiAuth";

// GET games for a season
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const date = searchParams.get("date");

        const weekStart = searchParams.get("weekStart");

        const filter = { league: id };
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

// CREATE game in a season (admin/organizer only)
export async function POST(request, { params }) {
    try {
        const auth = await requireAdmin();
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

        return NextResponse.json({ success: true, data: game }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
