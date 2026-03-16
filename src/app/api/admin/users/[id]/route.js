import { NextResponse } from "next/server";
import mongoose from "mongoose";
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

        if (auth.user.role !== "admin") {
            const requester = await User.findById(auth.user.id).select("organization").lean();
            if (!requester?.organization) {
                return NextResponse.json({ success: false, error: "You are not associated with an organization" }, { status: 403 });
            }
            const target = await User.findById(id).select("organization").lean();
            if (!target) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
            if (String(target.organization) !== String(requester.organization)) {
                return NextResponse.json({ success: false, error: "You can only manage users in your organization" }, { status: 403 });
            }
            if (body.role && ["admin", "organizer"].includes(body.role)) {
                return NextResponse.json({ success: false, error: "You cannot assign admin or organizer roles" }, { status: 403 });
            }
        }

        if (body.role) {
            const validRole = await Role.findOne({ slug: body.role });
            if (!validRole) {
                return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
            }
            update.role = body.role;
        }

        if (body.organization !== undefined && auth.user.role === "admin") {
            update.organization = body.organization || null;
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
            const target = await User.findById(id).select("organization").lean();
            if (!target) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
            if (String(target.organization) !== String(requester.organization)) {
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

export async function DELETE(request, { params }) {
    const auth = await requirePermission("manage_users");
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { id } = await params;

        if (id === auth.user.id) {
            return NextResponse.json({ success: false, error: "You cannot delete your own account" }, { status: 400 });
        }

        if (auth.user.role !== "admin") {
            const requester = await User.findById(auth.user.id).select("organization").lean();
            if (!requester?.organization) {
                return NextResponse.json({ success: false, error: "You are not associated with an organization" }, { status: 403 });
            }
            const target = await User.findById(id).select("organization").lean();
            if (!target) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
            if (String(target.organization) !== String(requester.organization)) {
                return NextResponse.json({ success: false, error: "You can only manage users in your organization" }, { status: 403 });
            }
        }

        if (id === auth.user.id) {
            return NextResponse.json(
                { success: false, error: "You cannot delete your own account" },
                { status: 400 }
            );
        }

        const user = await User.findByIdAndDelete(id);
        if (!user) {
            return NextResponse.json(
                { success: false, error: "User not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, message: "User deleted" });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
