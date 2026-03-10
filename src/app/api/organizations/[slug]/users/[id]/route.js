import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Organization from "@/models/Organization";
import { requireAdmin } from "@/lib/apiAuth";

/**
 * Helper to verify the user belongs to the org (guards cross-org access).
 */
async function getOrgAndUser(slug, userId) {
    await dbConnect();
    const org = await Organization.findOne({ slug }).lean();
    if (!org) return { error: "Organization not found", status: 404 };

    const user = await User.findById(userId).select("-password").lean();
    if (!user) return { error: "User not found", status: 404 };

    if (!user.organization || user.organization.toString() !== org._id.toString()) {
        return { error: "User does not belong to this organization", status: 403 };
    }

    return { org, user };
}

/**
 * PUT /api/organizations/[slug]/users/[id] — Edit a user's role within this org
 */
export async function PUT(request, { params }) {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    try {
        const { slug, id } = await params;
        const result = await getOrgAndUser(slug, id);
        if (result.error) {
            return NextResponse.json({ success: false, error: result.error }, { status: result.status });
        }

        const body = await request.json();
        const update = {};

        if (body.role) {
            if (body.role === "admin") {
                return NextResponse.json({ success: false, error: "Cannot assign admin role" }, { status: 403 });
            }
            update.role = body.role;
        }

        const user = await User.findByIdAndUpdate(id, update, { new: true, runValidators: true })
            .select("-password")
            .populate("organization", "name slug")
            .lean();

        return NextResponse.json({ success: true, data: user });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * PATCH /api/organizations/[slug]/users/[id] — Toggle active status
 */
export async function PATCH(request, { params }) {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    try {
        const { slug, id } = await params;
        const result = await getOrgAndUser(slug, id);
        if (result.error) {
            return NextResponse.json({ success: false, error: result.error }, { status: result.status });
        }

        const newStatus = result.user.isActive === false ? true : false;
        const oid = new mongoose.Types.ObjectId(id);
        await mongoose.connection.db.collection("users").updateOne(
            { _id: oid },
            { $set: { isActive: newStatus } }
        );

        const user = await User.findById(id).select("-password").lean();
        return NextResponse.json({ success: true, data: user });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/organizations/[slug]/users/[id] — Delete a user from this org
 */
export async function DELETE(request, { params }) {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    try {
        const { slug, id } = await params;
        const result = await getOrgAndUser(slug, id);
        if (result.error) {
            return NextResponse.json({ success: false, error: result.error }, { status: result.status });
        }

        await User.findByIdAndDelete(id);
        return NextResponse.json({ success: true, message: "User deleted" });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
