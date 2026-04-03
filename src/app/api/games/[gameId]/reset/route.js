import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Game from "@/models/Game";
import GameStat from "@/models/GameStat";
import Play from "@/models/Play";
import User from "@/models/User";
import League from "@/models/League";
import { requireAdmin, hasRole } from "@/lib/apiAuth";

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

// POST /api/games/[gameId]/reset
// Resets all scores, plays, and stats for a game. Organizer/admin only.
export async function POST(request, { params }) {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { gameId } = await params;

        const game = await Game.findById(gameId).lean();
        if (!game) {
            return NextResponse.json({ success: false, error: "Game not found" }, { status: 404 });
        }

        // Organizers may only reset games within their own organization
        if (hasRole(auth.user, "organizer") && !hasRole(auth.user, "admin")) {
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
                    { success: false, error: "You can only reset games within your organization" },
                    { status: 403 }
                );
            }
        }

        // Delete all plays and stats, reset scores and status
        await Promise.all([
            Play.deleteMany({ game: gameId }),
            GameStat.deleteMany({ game: gameId }),
            Game.findByIdAndUpdate(gameId, {
                $set: {
                    "teamA.score": null,
                    "teamB.score": null,
                    status: "upcoming",
                },
            }),
        ]);

        return NextResponse.json({ success: true, message: "Game stats and scores have been reset" });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
