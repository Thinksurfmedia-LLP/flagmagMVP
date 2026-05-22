import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import User from "@/models/User";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
        }

        await dbConnect();
        const player = await Player.findOne({ user: user.id }).lean();
        if (!player) {
            return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: player });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });
        }

        await dbConnect();
        const body = await request.json();

        // Whitelist only safe profile fields a player can self-edit
        const ALLOWED = ["name", "photo", "bannerImage", "about", "location", "locationsDescription", "socialLinks"];
        const updates = {};
        for (const key of ALLOWED) {
            if (key in body) updates[key] = body[key];
        }

        // Sanitize socialLinks to only allow known sub-keys
        if (updates.socialLinks) {
            const { facebook = "", instagram = "", youtube = "" } = updates.socialLinks;
            updates.socialLinks = { facebook, instagram, youtube };
        }

        const player = await Player.findOneAndUpdate(
            { user: user.id },
            updates,
            { new: true, runValidators: true }
        ).lean();

        if (!player) {
            return NextResponse.json({ success: false, error: "Player not found" }, { status: 404 });
        }

        // Keep User.name in sync if name was updated
        if (updates.name) {
            await User.findByIdAndUpdate(user.id, { name: updates.name });
        }

        return NextResponse.json({ success: true, data: player });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
