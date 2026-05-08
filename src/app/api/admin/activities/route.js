import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Activity from "@/models/Activity";
import User from "@/models/User";
import { requireAdmin } from "@/lib/apiAuth";

export async function GET() {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        
        let query = {};
        if (!auth.user.roles?.includes("admin") && auth.user.role !== "admin") {
            const requester = await User.findById(auth.user.id).select("organization").lean();
            if (!requester?.organization) {
                return NextResponse.json({ success: true, data: [] });
            }
            query.organization = requester.organization;
        }

        const activities = await Activity.find(query)
            .populate("user", "name email role profilePicture")
            .populate("organization", "name slug")
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();

        return NextResponse.json({ success: true, data: activities });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
