import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Season from "@/models/Season";
import League from "@/models/League";
import Game from "@/models/Game";
import { requireAuth, hasRole } from "@/lib/apiAuth";

export async function GET() {
    const auth = await requireAuth();
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();

        const isAdmin = hasRole(auth.user, "admin");
        const orgId = auth.user.organization?.id;

        let users, seasons, leagues, games;

        if (isAdmin) {
            // Admin sees global counts
            [users, seasons, leagues, games] = await Promise.all([
                User.countDocuments(),
                Season.countDocuments(),
                League.countDocuments(),
                Game.countDocuments(),
            ]);
        } else {
            // Organizer sees only counts scoped to their organization
            const orgLeagues = await League.find({ organization: orgId }, "_id").lean();
            const leagueIds = orgLeagues.map(l => l._id);

            [users, seasons, leagues, games] = await Promise.all([
                User.countDocuments({ organization: orgId }),
                Season.countDocuments({ organization: orgId }),
                League.countDocuments({ organization: orgId }),
                Game.countDocuments({ league: { $in: leagueIds } }),
            ]);
        }

        return NextResponse.json({
            success: true,
            data: { users, seasons, leagues, games },
        });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
