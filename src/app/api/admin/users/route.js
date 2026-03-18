import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Player from "@/models/Player";
import Organization from "@/models/Organization";
import Role from "@/models/Role";
import { requirePermission } from "@/lib/apiAuth";

export async function GET() {
    const auth = await requirePermission("manage_users");
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        let query = {};
        if (auth.user.role !== "admin") {
            const requester = await User.findById(auth.user.id).select("organization").lean();
            if (!requester?.organization) return NextResponse.json({ success: true, data: [] });
            query.organization = requester.organization;
        }
        const users = await User.find(query, "-password").populate("organization", "name slug").sort({ createdAt: -1 }).lean();
        return NextResponse.json({ success: true, data: users });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    const auth = await requirePermission("manage_users");
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { name, email, phone, password, role, roles: rolesInput, organization } = await request.json();

        if (!name || !email || !password) {
            return NextResponse.json({ success: false, error: "Name, email, and password are required" }, { status: 400 });
        }
        if (password.length < 6) {
            return NextResponse.json({ success: false, error: "Password must be at least 6 characters" }, { status: 400 });
        }

        // Build the final roles array; fall back to single role for backwards compat
        let assignedRoles = Array.isArray(rolesInput) && rolesInput.length > 0 ? rolesInput : [role || "viewer"];
        const primaryRole = assignedRoles[0];

        let assignedOrg = organization || null;
        if (auth.user.role !== "admin") {
            const requester = await User.findById(auth.user.id).select("organization").lean();
            assignedOrg = requester?.organization || null;
            if (assignedRoles.some(r => ["admin", "organizer"].includes(r))) {
                return NextResponse.json({ success: false, error: "You can only create free agent accounts" }, { status: 403 });
            }
        }

        // Nobody can create player directly — only via team assignment
        if (assignedRoles.includes("player")) {
            return NextResponse.json({ success: false, error: "Players can only be promoted from free agents via team assignment" }, { status: 400 });
        }

        // Free agent requires an organization
        if (assignedRoles.includes("free_agent") && !assignedOrg) {
            return NextResponse.json({ success: false, error: "Organization is required for free agent accounts" }, { status: 400 });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return NextResponse.json({ success: false, error: "User with this email already exists" }, { status: 409 });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            name,
            email,
            phone: phone || "",
            password: hashedPassword,
            role: primaryRole,
            roles: assignedRoles,
            ...(assignedOrg ? { organization: assignedOrg } : {}),
        });

        const userData = await User.findById(user._id)
            .select("-password")
            .populate("organization", "name slug")
            .lean();

        // If free_agent role, also create a Player doc for the assigned org
        if (assignedRoles.includes("free_agent") && assignedOrg) {
            const existingPlayer = await Player.findOne({ user: user._id, organization: assignedOrg });
            if (!existingPlayer) {
                await Player.create({
                    user: user._id,
                    name: user.name,
                    organization: assignedOrg,
                    status: "free_agent",
                });
            }
        }

        return NextResponse.json({ success: true, data: userData }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
