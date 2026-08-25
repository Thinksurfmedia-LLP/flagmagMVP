import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Role from "@/models/Role";
import { signToken, setAuthCookie } from "@/lib/auth";
import { registerFreeAgent } from "@/lib/registration/freeAgent";
import { RegistrationError } from "@/lib/registration/errors";

// Public self-serve registration: "I'm a free agent looking to join a league."
export async function POST(request) {
    try {
        await dbConnect();
        const {
            name,
            email,
            phone,
            password,
            confirmPassword,
            organizationId,
            requestedLeagueId,
            address,
            state,
            location,
            notes,
        } = await request.json();

        if (confirmPassword && password !== confirmPassword) {
            return NextResponse.json({ success: false, error: "Passwords do not match" }, { status: 400 });
        }

        const { user } = await registerFreeAgent({
            name,
            email,
            phone,
            password,
            organizationId,
            requestedLeagueId,
            address,
            state,
            location,
            notes,
        });

        const roleDoc = await Role.findOne({ slug: user.role }).lean();
        const perms = roleDoc ? [...roleDoc.permissions] : [];
        const token = await signToken({
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
            roles: user.roles,
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
                    roles: user.roles,
                    permissions: perms,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof RegistrationError) {
            return NextResponse.json({ success: false, error: error.message }, { status: error.status });
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
