import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import User from "@/models/User";
import { requireAdmin } from "@/lib/apiAuth";
import { invalidateOrgCutoffCache } from "@/lib/auth";

// Admin, or the organizer of THIS specific organization, only.
async function canManageOrg(user, organizationId) {
    const allRoles = user.roles?.length ? user.roles : [user.role];
    if (allRoles.includes("admin")) return true;

    const userDoc = await User.findById(user.id).select("organization roleOrganizations").lean();
    const ownedOrgIds = new Set();
    if (userDoc?.organization) ownedOrgIds.add(String(userDoc.organization));

    const roleOrgId = userDoc?.roleOrganizations?.organizer;
    if (roleOrgId) {
        (Array.isArray(roleOrgId) ? roleOrgId : [roleOrgId]).forEach((id) => ownedOrgIds.add(String(id)));
    }

    return ownedOrgIds.has(String(organizationId));
}

// Bumps this org's sessions cutoff so every JWT already issued for it -
// organizer or statistician, admin dashboard or stats app - stops passing
// auth checks on its next request. Forces everyone linked to this org,
// including the caller, back to the login screen.
export async function POST(request, { params }) {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { slug } = await params;

        const organization = await Organization.findOne({ slug });
        if (!organization) {
            return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
        }

        if (!(await canManageOrg(auth.user, organization._id))) {
            return NextResponse.json(
                { success: false, error: "You can only manage your own organization" },
                { status: 403 }
            );
        }

        organization.sessionsInvalidatedAt = new Date();
        await organization.save();
        invalidateOrgCutoffCache(organization._id);

        return NextResponse.json({
            success: true,
            data: { sessionsInvalidatedAt: organization.sessionsInvalidatedAt },
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
