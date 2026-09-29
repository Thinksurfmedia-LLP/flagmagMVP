import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Role from "@/models/Role";
import User from "@/models/User";
import Organization from "@/models/Organization";
import { getMobileAuthState, MOBILE_COOKIE_NAME } from "@/lib/auth";

export async function GET() {
    try {
        const { user, invalidated, sessionEnded } = await getMobileAuthState();

        if (!user) {
            // sessionEnded: there WAS a login but it's expired / was logged out
            // (e.g. the mandatory nightly logout) — the app shows "your session
            // ended, sign in again" instead of a plain login screen. The dead
            // cookie is cleared so it isn't re-sent on every request.
            const res = NextResponse.json({ success: false, error: "Not authenticated", invalidated, sessionEnded }, { status: 401 });
            if (sessionEnded) res.cookies.delete(MOBILE_COOKIE_NAME);
            return res;
        }

        await dbConnect();
        const userDoc = await User.findById(user.id)
            .select("organization roles roleOrganizations profilePicture")
            .populate("organization", "name slug logo")
            .lean();
        const roles = userDoc?.roles?.length ? [...userDoc.roles] : [user.role];
        const roleDocs = await Role.find({ slug: { $in: roles } }).lean();
        const permissions = [...new Set(roleDocs.flatMap(r => r.permissions))];

        let roleOrganizations = {};
        if (userDoc?.roleOrganizations) {
            const orgIds = Object.values(userDoc.roleOrganizations).flatMap(v => Array.isArray(v) ? v : [v]);
            const orgs = await Organization.find({ _id: { $in: orgIds } }).select("name slug logo").lean();
            for (const [r, orgId] of Object.entries(userDoc.roleOrganizations)) {
                const resolvedId = Array.isArray(orgId) ? orgId[0] : orgId;
                const matchingOrg = orgs.find(o => String(o._id) === String(resolvedId));
                if (matchingOrg) {
                    roleOrganizations[r] = {
                        id: matchingOrg._id,
                        name: matchingOrg.name,
                        slug: matchingOrg.slug,
                        logo: matchingOrg.logo || "",
                    };
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                roles,
                permissions,
                profilePicture: userDoc?.profilePicture || "",
                organization: userDoc?.organization
                    ? {
                        id: userDoc.organization._id,
                        name: userDoc.organization.name,
                        slug: userDoc.organization.slug,
                        logo: userDoc.organization.logo || "",
                    }
                    : null,
                roleOrganizations,
            },
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
