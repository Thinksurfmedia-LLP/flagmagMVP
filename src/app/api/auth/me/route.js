import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Role from "@/models/Role";
import User from "@/models/User";
import "@/models/Organization"; // register schema for populate
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
            .select("organization roles")
            .populate("organization", "name slug logo")
            .lean();
        const roles = userDoc?.roles?.length ? [...userDoc.roles] : [user.role];
        const roleDocs = await Role.find({ slug: { $in: roles } }).lean();
        const permissions = [...new Set(roleDocs.flatMap(r => r.permissions))];

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
