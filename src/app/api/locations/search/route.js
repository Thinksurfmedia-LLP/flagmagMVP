import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Venue from "@/models/Location";
import { requireAuth } from "@/lib/apiAuth";

/**
 * GET /api/locations/search?names=Venue1,Venue2
 * Returns name + fields for the requested venue names.
 * Requires any authenticated session.
 */
export async function GET(request) {
    const auth = await requireAuth();
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const namesParam = searchParams.get("names") || "";
        const names = namesParam
            .split(",")
            .map((n) => n.trim())
            .filter(Boolean);

        if (names.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        const venues = await Venue.find({ name: { $in: names } })
            .select("name fields")
            .lean();

        return NextResponse.json({ success: true, data: venues });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
