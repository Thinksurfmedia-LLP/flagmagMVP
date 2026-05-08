import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { requireAuth } from "@/lib/apiAuth";

export async function PATCH(request) {
    try {
        const auth = await requireAuth();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const body = await request.json();
        
        const update = {};
        if (body.profilePicture !== undefined) {
            update.profilePicture = body.profilePicture;
        }

        const user = await User.findByIdAndUpdate(auth.user.id, update, { new: true })
            .select("-password")
            .lean();

        return NextResponse.json({ success: true, data: user });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
