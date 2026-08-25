import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Role from "@/models/Role";
import { signToken, setAuthCookie } from "@/lib/auth";
import { registerTeam } from "@/lib/registration/team";
import { RegistrationError } from "@/lib/registration/errors";

// Public self-serve registration: "I'm registering my team for a league."
export async function POST(request) {
    try {
        await dbConnect();
        const {
            name,
            email,
            phone,
            password,
            confirmPassword,
            teamName,
            organizationId,
            requestedLeagueId,
            address,
            state,
            location,
            hearAboutUs,
            notes,
        } = await request.json();

        if (confirmPassword && password !== confirmPassword) {
            return NextResponse.json({ success: false, error: "Passwords do not match" }, { status: 400 });
        }

        const { user, team } = await registerTeam({
            name,
            email,
            phone,
            password,
            teamName,
            organizationId,
            requestedLeagueId,
            address,
            state,
            location,
            hearAboutUs,
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
                    teamId: team._id,
                    teamName: team.name,
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
