import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Season from "@/models/Season";
import League from "@/models/League";
import Game from "@/models/Game";
import mongoose from "mongoose";
import { requireAuth, hasRole } from "@/lib/apiAuth";

export async function GET() {
    const auth = await requireAuth();
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();

        const isAdmin = hasRole(auth.user, "admin");

        // Resolve org ID: JWT may only have it if user.organization field is set.
        // Fall back to a DB lookup for users whose org comes from roleOrganizations.
        let orgId = auth.user.organization?.id;
        if (!isAdmin && !orgId) {
            const userDoc = await User.findById(auth.user.id)
                .select("organization roleOrganizations")
                .lean();
            if (userDoc?.organization) {
                orgId = String(userDoc.organization);
            } else if (userDoc?.roleOrganizations) {
                const allRoles = auth.user.roles?.length ? auth.user.roles : [auth.user.role];
                for (const role of allRoles) {
                    const val = userDoc.roleOrganizations[role];
                    if (val) { orgId = String(Array.isArray(val) ? val[0] : val); break; }
                }
            }
        }

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
            // Organizer sees only counts scoped to their organization.
            // Users may belong via the direct `organization` field OR via `roleOrganizations`.
            // roleOrganizations is Mixed so values may be stored as strings — include both forms.
            const orgObjectId = new mongoose.Types.ObjectId(orgId);
            const orgLeagues = await League.find({ organization: orgId }, "_id").lean();
            const leagueIds = orgLeagues.map(l => l._id);

            [users, seasons, leagues, games] = await Promise.all([
                User.countDocuments({
                    $or: [
                        { organization: orgObjectId },
                        { "roleOrganizations.organizer": { $in: [orgId, orgObjectId] } },
                        { "roleOrganizations.statistician": { $in: [orgId, orgObjectId] } },
                        { "roleOrganizations.free_agent": { $in: [orgId, orgObjectId] } },
                    ],
                }),
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
