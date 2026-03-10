import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import User from "@/models/User";
import Player from "@/models/Player";
import { requireAdmin } from "@/lib/apiAuth";

// GET players for an organization (through user.organization)
export async function GET(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { slug } = await params;

        const org = await Organization.findOne({ slug }).lean();
        if (!org) {
            return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
        }

        // Find users belonging to this org
        const orgUsers = await User.find({ organization: org._id }).select("_id").lean();
        const userIds = orgUsers.map(u => u._id);

        // Find players linked to those users
        const players = await Player.find({ user: { $in: userIds } }).sort({ name: 1 }).lean();

        return NextResponse.json({ success: true, count: players.length, data: players }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// CREATE player for this org
export async function POST(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { slug } = await params;

        const org = await Organization.findOne({ slug }).lean();
        if (!org) {
            return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
        }

        const body = await request.json();

        // If a userId is provided, ensure it belongs to this org
        if (body.user) {
            const linkedUser = await User.findById(body.user).lean();
            if (!linkedUser || String(linkedUser.organization) !== String(org._id)) {
                return NextResponse.json({ success: false, error: "User does not belong to this organization" }, { status: 403 });
            }
        }

        const player = await Player.create(body);
        return NextResponse.json({ success: true, data: player }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
