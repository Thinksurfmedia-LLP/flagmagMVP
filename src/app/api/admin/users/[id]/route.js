import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Role from "@/models/Role";
import { requirePermission } from "@/lib/apiAuth";

export async function PUT(request, { params }) {
    const auth = await requirePermission("manage_users");
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { id } = await params;
        const body = await request.json();
        const update = {};

        if (body.name) update.name = body.name;
        if (body.email) {
            const existingUser = await User.findOne({ email: body.email });
            if (existingUser && existingUser._id.toString() !== id) {
                return NextResponse.json({ success: false, error: "User with this email already exists" }, { status: 409 });
            }
            update.email = body.email;
        }
        if (body.phone !== undefined) update.phone = body.phone;
        
        if (body.password) {
            if (body.password.length < 6) {
                return NextResponse.json({ success: false, error: "Password must be at least 6 characters" }, { status: 400 });
            }
            const salt = await bcrypt.genSalt(10);
            update.password = await bcrypt.hash(body.password, salt);
        }

        if (auth.user.role !== "admin") {
            const requester = await User.findById(auth.user.id).select("organization").lean();
            if (!requester?.organization) {
                return NextResponse.json({ success: false, error: "You are not associated with an organization" }, { status: 403 });
            }
            const target = await User.findById(id).select("organization roleOrganizations").lean();
            if (!target) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
            const targetOrgs = target.roleOrganizations ? Object.values(target.roleOrganizations).flat().map(String) : [];
            if (target.organization) targetOrgs.push(String(target.organization));
            
            if (!targetOrgs.includes(String(requester.organization))) {
                return NextResponse.json({ success: false, error: "You can only manage users in your organization" }, { status: 403 });
            }
            const incomingRoles = Array.isArray(body.roles) ? body.roles : (body.role ? [body.role] : []);
            if (incomingRoles.some(r => ["admin", "organizer"].includes(r))) {
                return NextResponse.json({ success: false, error: "You cannot assign admin or organizer roles" }, { status: 403 });
            }
        }

        if (Array.isArray(body.roles) && body.roles.length > 0) {
            // Validate each role slug exists
            const count = await Role.countDocuments({ slug: { $in: body.roles } });
            if (count !== body.roles.length) {
                return NextResponse.json({ success: false, error: "One or more roles are invalid" }, { status: 400 });
            }
            update.roles = body.roles;
            update.role = body.roles[0];
        } else if (body.role) {
            const validRole = await Role.findOne({ slug: body.role });
            if (!validRole) {
                return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
            }
            update.role = body.role;
            update.roles = [body.role];
        }

        if (body.organization !== undefined && auth.user.role === "admin") {
            update.organization = body.organization || null;
        }
        if (body.roleOrganizations !== undefined) {
            let passedRoleOrgs = body.roleOrganizations || {};
            if (auth.user.role !== "admin") {
                 const requester = await User.findById(auth.user.id).select("organization").lean();
                 const assignedOrg = requester?.organization || null;
                 const incomingRoles = Array.isArray(body.roles) ? body.roles : (body.role ? [body.role] : []);
                 incomingRoles.forEach(r => {
                     if (!["viewer", "player", "admin"].includes(r)) {
                         passedRoleOrgs[r] = assignedOrg ? [assignedOrg] : [];
                     }
                 });
            }
            update.roleOrganizations = passedRoleOrgs;
        }

        const user = await User.findByIdAndUpdate(id, update, { new: true, runValidators: true })
            .select("-password")
            .populate("organization", "name slug")
            .lean();

        if (!user) {
            return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: user });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request, { params }) {
    const auth = await requirePermission("manage_users");
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { id } = await params;

        if (id === auth.user.id) {
            return NextResponse.json(
                { success: false, error: "You cannot deactivate your own account" },
                { status: 400 }
            );
        }

        if (auth.user.role !== "admin") {
            const requester = await User.findById(auth.user.id).select("organization").lean();
            if (!requester?.organization) {
                return NextResponse.json({ success: false, error: "You are not associated with an organization" }, { status: 403 });
            }
            const target = await User.findById(id).select("organization roleOrganizations").lean();
            if (!target) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
            const targetOrgs = target.roleOrganizations ? Object.values(target.roleOrganizations).flat().map(String) : [];
            if (target.organization) targetOrgs.push(String(target.organization));
            
            if (!targetOrgs.includes(String(requester.organization))) {
                return NextResponse.json({ success: false, error: "You can only manage users in your organization" }, { status: 403 });
            }
        }

        const existing = await User.findById(id).select("isActive").lean();
        if (!existing) {
            return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404 }
            );
        }

        const newStatus = existing.isActive === false ? true : false;

        // Use native MongoDB driver to bypass Mongoose strict mode / cached schema
        const oid = new mongoose.Types.ObjectId(id);
        await mongoose.connection.db.collection("users").updateOne(
            { _id: oid },
            { $set: { isActive: newStatus } }
        );

        const user = await User.findById(id).select("-password").lean();

        return NextResponse.json({ success: true, data: user });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}


