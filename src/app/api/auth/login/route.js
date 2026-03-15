import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Role from "@/models/Role";
import { signToken, setAuthCookie } from "@/lib/auth";

export async function POST(request) {
    try {
        await dbConnect();
        const { email, password } = await request.json();

        // Validation
        if (!email || !password) {
            return NextResponse.json(
                { success: false, error: "Email and password are required" },
                { status: 400 }
            );
        }

        // Find user
        const user = await User.findOne({ email }).populate("organization", "name slug logo");
        if (!user) {
            return NextResponse.json(
                { success: false, error: "Invalid email or password" },
                { status: 401 }
            );
        }

        // Compare hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return NextResponse.json(
                { success: false, error: "Invalid email or password" },
                { status: 401 }
            );
        }

        // Look up role permissions
        const roleDoc = await Role.findOne({ slug: user.role }).lean();
        const perms = roleDoc ? [...roleDoc.permissions] : [];
        const token = await signToken({
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            permissions: perms,
        });
        await setAuthCookie(token);

        return NextResponse.json(
            {
                success: true,
                data: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    permissions: perms,
                    organization: user.organization
                        ? {
                            id: user.organization._id,
                            name: user.organization.name,
                            slug: user.organization.slug,
                            logo: user.organization.logo || "",
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
