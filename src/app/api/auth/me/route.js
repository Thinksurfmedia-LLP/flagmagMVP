import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Role from "@/models/Role";
import User from "@/models/User";
import Organization from "@/models/Organization";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
    try {
        const user = await getCurrentUser();

        if (!user) {
            return NextResponse.json(
                { success: false, error: "Not authenticated" },
                { status: 401 }
            );
        }

        // Look up fresh permissions from all assigned roles
        await dbConnect();
        const userDoc = await User.findById(user.id)
            .select("organization roles roleOrganizations")
            .populate("organization", "name slug logo")
            .lean();
        const roles = userDoc?.roles?.length ? [...userDoc.roles] : [user.role];
        const roleDocs = await Role.find({ slug: { $in: roles } }).lean();
        const permissions = [...new Set(roleDocs.flatMap(r => r.permissions))];

        let roleOrganizations = {};
        if (userDoc?.roleOrganizations) {
            // roleOrganizations values may be a single id or an array of ids (free_agent supports multiple)
            const orgIds = Object.values(userDoc.roleOrganizations).flatMap(v => Array.isArray(v) ? v : [v]);
            const orgs = await Organization.find({ _id: { $in: orgIds } }).select("name slug logo").lean();
            for (const [r, orgId] of Object.entries(userDoc.roleOrganizations)) {
                // Take the first id when stored as an array
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

        return NextResponse.json(
            {
                success: true,
                data: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    roles,
                    permissions,
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
            },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
