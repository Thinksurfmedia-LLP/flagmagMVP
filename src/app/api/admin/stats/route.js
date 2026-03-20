import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Organization from "@/models/Organization";
import Season from "@/models/Season";
import League from "@/models/League";
import Game from "@/models/Game";
import { requireAuth } from "@/lib/apiAuth";

export async function GET() {
    const auth = await requireAuth();
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const [users, organizations, seasons, leagues, games] = await Promise.all([
            User.countDocuments(),
            Organization.countDocuments(),
            Season.countDocuments(),
            League.countDocuments(),
            Game.countDocuments(),
        ]);

        return NextResponse.json({
            success: true,
            data: { users, organizations, seasons, leagues, games },
        });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
