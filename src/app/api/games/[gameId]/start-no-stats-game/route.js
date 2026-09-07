import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Game from "@/models/Game";
import Team from "@/models/Team";
import League from "@/models/League";
import Schedule from "@/models/Schedule";
import { requireAdminOrStatistician } from "@/lib/apiAuth";
import { findOrCreateStatsTwin } from "@/lib/statsTwinTeams";

// POST /api/games/[gameId]/start-no-stats-game
// Body: { forfeitSide: "A"|"B", standInTeamId }
//
// A forfeit becomes TWO separate things, not one game reused for both:
//   1. The originally-scheduled game is completed right now as a real
//      forfeit (0-6 / 6-0), exactly like the direct "No" path — it keeps
//      counting normally toward standings/stats, same as any other forfeit.
//   2. A brand-new Game (and matching Schedule week entry, same week as the
//      original) is created for a live scrimmage between the real, present
//      team's "<Team> STATS" twin and the chosen stand-in's own twin — same
//      rosters as the real teams (so plays still resolve to real players),
//      but a visibly distinct "STATS" identity for this one-off fixture
//      (see statsTwinTeams.js). `noStatsBothSides: true` ALSO keeps this
//      game out of every league/season aggregate (standings, game-stats team
//      records, league/season player stats, the season leaderboard) — its
//      own box score/plays are still fully viewable if you click into it.
export async function POST(request, { params }) {
    try {
        const auth = await requireAdminOrStatistician();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { gameId } = await params;
        const body = await request.json();
        const { forfeitSide, standInTeamId } = body;

        if (!["A", "B"].includes(forfeitSide) || !standInTeamId) {
            return NextResponse.json(
                { success: false, error: "forfeitSide (A or B) and standInTeamId are required" },
                { status: 400 }
            );
        }

        const original = await Game.findById(gameId).lean();
        if (!original) {
            return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 });
        }

        const league = await League.findById(original.league).select("organization").lean();
        if (!league) {
            return NextResponse.json({ success: false, error: "League not found for this game" }, { status: 404 });
        }

        const realSide = forfeitSide === "A" ? "B" : "A";
        const realTeamSlot = original[`team${realSide}`];

        const [realTeamDoc, standInTeamDoc] = await Promise.all([
            Team.findOne({ organization: league.organization, name: realTeamSlot.name }).select("name logo players organization").lean(),
            Team.findById(standInTeamId).select("name logo players organization").lean(),
        ]);
        if (!realTeamDoc) {
            return NextResponse.json({ success: false, error: `Team "${realTeamSlot.name}" not found` }, { status: 404 });
        }
        if (!standInTeamDoc) {
            return NextResponse.json({ success: false, error: "Stand-in team not found" }, { status: 404 });
        }

        // Both rosters need enough players to actually field a game — check
        // this BEFORE touching anything, so a failed check leaves the
        // original fixture untouched (no forfeit without a replacement).
        const MIN_PLAYERS = 4;
        const shortRosters = [];
        if ((realTeamDoc.players || []).length < MIN_PLAYERS) shortRosters.push(realTeamDoc.name);
        if ((standInTeamDoc.players || []).length < MIN_PLAYERS) shortRosters.push(standInTeamDoc.name);
        if (shortRosters.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: `${shortRosters.join(" and ")} ${shortRosters.length > 1 ? "don't" : "doesn't"} have at least ${MIN_PLAYERS} players on the roster. Add players first.`,
                },
                { status: 400 }
            );
        }

        // 1. Complete the original fixture as a real forfeit — dot-notation
        // score updates only, so the real team names/logos are untouched.
        const completedOriginal = await Game.findByIdAndUpdate(
            gameId,
            {
                status: "completed",
                [`team${forfeitSide}.score`]: 0,
                [`team${realSide}.score`]: 6,
            },
            { new: true }
        );

        // 2. Create the new live scrimmage as its own Game, between each
        // real team's "STATS" twin.
        const [realTwin, standInTwin] = await Promise.all([
            findOrCreateStatsTwin(realTeamDoc, original.league),
            findOrCreateStatsTwin(standInTeamDoc, original.league),
        ]);

        const newTeamA = realSide === "A"
            ? { name: realTwin.name, logo: realTwin.logo || "", score: 0 }
            : { name: standInTwin.name, logo: standInTwin.logo || "", score: 0 };
        const newTeamB = realSide === "B"
            ? { name: realTwin.name, logo: realTwin.logo || "", score: 0 }
            : { name: standInTwin.name, logo: standInTwin.logo || "", score: 0 };

        const newGame = await Game.create({
            league: original.league,
            date: original.date,
            time: original.time,
            location: original.location,
            sectionName: original.sectionName,
            gameType: original.gameType,
            status: "in_progress",
            noStatsBothSides: true,
            teamA: newTeamA,
            teamB: newTeamB,
        });

        // Sync the new game into the schedule under the same week as the
        // original, mirroring seasons/[id]/games/route.js's create-game sync.
        try {
            const teamAId = realSide === "A" ? realTwin._id : standInTwin._id;
            const teamBId = realSide === "B" ? realTwin._id : standInTwin._id;

            const dashIdx = (newGame.location || "").indexOf(" - ");
            const fieldName = dashIdx > -1 ? newGame.location.slice(dashIdx + 3) : "";

            let weekLabel = newGame.sectionName?.trim();
            if (!weekLabel) {
                const gameDate = new Date(newGame.date);
                const weekStart = new Date(gameDate);
                weekStart.setUTCDate(gameDate.getUTCDate() - gameDate.getUTCDay());
                weekLabel = `Week of ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
            }

            const dateStr = newGame.date instanceof Date
                ? newGame.date.toISOString().split("T")[0]
                : new Date(newGame.date).toISOString().split("T")[0];

            const gameEntry = {
                team1: teamAId,
                team2: teamBId,
                field: fieldName,
                date: dateStr,
                time: newGame.time || "",
                gameType: newGame.gameType || "main",
                gameRef: newGame._id,
            };

            const existingSchedule = await Schedule.findOne({ leagueId: original.league }).select("_id weeks").lean();
            if (existingSchedule) {
                const weekIdx = (existingSchedule.weeks || []).findIndex((w) => w.name === weekLabel);
                if (weekIdx >= 0) {
                    await Schedule.updateOne(
                        { _id: existingSchedule._id },
                        { $push: { [`weeks.${weekIdx}.games`]: gameEntry } }
                    );
                } else {
                    await Schedule.updateOne(
                        { _id: existingSchedule._id },
                        { $push: { weeks: { name: weekLabel, games: [gameEntry] } } }
                    );
                }
            }
        } catch (scheduleErr) {
            console.error("No Stats Game schedule sync failed:", scheduleErr);
        }

        return NextResponse.json(
            { success: true, data: { completedOriginal, newGame } },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
