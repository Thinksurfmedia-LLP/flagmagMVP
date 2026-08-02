import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Game from "@/models/Game";
import Schedule from "@/models/Schedule";
import User from "@/models/User";
import League from "@/models/League";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";

async function getOrgIdForOrganizer(authUser) {
    if (authUser.organization?.id) return authUser.organization.id;
    const userDoc = await User.findById(authUser.id)
        .select("organization roleOrganizations")
        .lean();

    if (userDoc?.roleOrganizations?.organizer) {
        const orgs = userDoc.roleOrganizations.organizer;
        if (Array.isArray(orgs) && orgs.length > 0) return String(orgs[0]);
        if (typeof orgs === "string") return String(orgs);
    }

    return userDoc?.organization ? String(userDoc.organization) : null;
}

// POST /api/games/[gameId]/reset-fixture
// Reverts teamA/teamB back to the placeholder team (e.g. "TBD") they held
// before a real team was assigned, using the snapshot captured on resolution.
// Does not touch scores/stats/status — see /reset for that.
export async function POST(request, { params }) {
    const auth = await requireAnyPermission(["manage_games", "game_update", "stats_record"]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { gameId } = await params;

        const game = await Game.findById(gameId).lean();
        if (!game) {
            return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 });
        }

        if (!hasRole(auth.user, "admin")) {
            const orgId = await getOrgIdForOrganizer(auth.user);
            if (!orgId) {
                return NextResponse.json(
                    { success: false, error: "Organizer is not assigned to an organization" },
                    { status: 403 }
                );
            }
            const league = await League.findById(game.league).select("organization").lean();
            if (!league || String(league.organization) !== orgId) {
                return NextResponse.json(
                    { success: false, error: "You can only edit games within your organization" },
                    { status: 403 }
                );
            }
        }

        if (!game.originalTeamA?.name && !game.originalTeamB?.name) {
            return NextResponse.json(
                { success: false, error: "This game has no original placeholder fixture to restore" },
                { status: 400 }
            );
        }

        const setFields = {};
        const unsetFields = {};
        if (game.originalTeamA?.name) {
            setFields["teamA.name"] = game.originalTeamA.name;
            setFields["teamA.logo"] = game.originalTeamA.logo || "";
            unsetFields.originalTeamA = "";
        }
        if (game.originalTeamB?.name) {
            setFields["teamB.name"] = game.originalTeamB.name;
            setFields["teamB.logo"] = game.originalTeamB.logo || "";
            unsetFields.originalTeamB = "";
        }

        const update = { $set: setFields, $unset: unsetFields };
        const updated = await Game.findByIdAndUpdate(gameId, update, { new: true });

        // Sync the restored placeholder back to any Schedule entry for this game
        try {
            await Schedule.updateMany(
                { "weeks.games.gameRef": game._id },
                {
                    $set: {
                        ...(game.originalTeamA?.name ? { "weeks.$[w].games.$[g].team1": game.originalTeamA.teamId || null } : {}),
                        ...(game.originalTeamB?.name ? { "weeks.$[w].games.$[g].team2": game.originalTeamB.teamId || null } : {}),
                    },
                },
                {
                    arrayFilters: [
                        { "w.games.gameRef": game._id },
                        { "g.gameRef": game._id },
                    ],
                }
            );
        } catch (syncError) {
            console.error("Failed to sync fixture reset to schedule:", syncError);
        }

        return NextResponse.json({ success: true, data: updated, message: "Fixture reverted to original placeholder teams" });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
