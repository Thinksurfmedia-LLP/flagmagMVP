import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Role from "@/models/Role";
import User from "@/models/User";
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

        // Look up fresh permissions from Role model
        await dbConnect();
        const userDoc = await User.findById(user.id)
            .select("organization")
            .populate("organization", "name slug logo")
            .lean();
        const roleDoc = await Role.findOne({ slug: user.role }).lean();
        const permissions = roleDoc ? [...roleDoc.permissions] : [];

        return NextResponse.json(
            {
                success: true,
                data: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
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
