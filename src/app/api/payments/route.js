import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { requireAuth, hasRole } from "@/lib/apiAuth";

// Same lookup used by /api/free-agents and /api/teams for an organizer's
// own org — duplicated locally rather than shared, matching how those
// routes already do it in this codebase.
async function getOrgIdForOrganizer(authUser) {
    if (authUser.organization?.id) return authUser.organization.id;
    const userDoc =
        (await User.findById(authUser.id).select("organization roleOrganizations").lean()) ||
        (await User.findOne({ email: authUser.email }).select("organization roleOrganizations").lean());

    if (userDoc?.roleOrganizations?.organizer) {
        const orgs = userDoc.roleOrganizations.organizer;
        if (Array.isArray(orgs) && orgs.length > 0) return String(orgs[0]);
        if (typeof orgs === "string") return String(orgs);
    }

    return userDoc?.organization ? String(userDoc.organization) : null;
}

// GET — admin sees every registration/payment; an organizer sees only the
// ones made against their own organization. Anyone else is refused.
export async function GET() {
    const auth = await requireAuth();
    if (!auth.authorized) return auth.response;

    const isAdmin = auth.user.role === "admin" || auth.user.roles?.includes("admin");
    const isOrganizer = hasRole(auth.user, "organizer");
    if (!isAdmin && !isOrganizer) {
        return NextResponse.json({ success: false, error: "Admin or organizer access required" }, { status: 403 });
    }

    try {
        await dbConnect();

        const filter = {};
        if (!isAdmin) {
            const orgId = await getOrgIdForOrganizer(auth.user);
            if (!orgId) {
                return NextResponse.json({ success: false, error: "Organizer is not assigned to an organization" }, { status: 400 });
            }
            filter.organization = orgId;
        }

        const payments = await Payment.find(filter)
            .sort({ createdAt: -1 })
            .populate("user", "name email phone")
            .lean();
        return NextResponse.json({ success: true, data: payments });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
