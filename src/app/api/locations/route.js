import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Venue from "@/models/Location";
import "@/models/County";
import "@/models/State";
import { requireAdmin } from "@/lib/apiAuth";

export async function GET() {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();

        const venues = await Venue.find({})
            .populate({
                path: "county",
                select: "name state",
                populate: { path: "state", select: "name abbreviation" },
            })
            .sort({ name: 1 })
            .lean();

        const data = venues.map((venue) => ({
            _id: venue._id,
            name: venue.name,
            address: venue.address || "",
            fieldCount: venue.fieldCount ?? null,
            managerName: venue.managerName || "",
            managerPhone: venue.managerPhone || "",
            countyId: venue.county?._id || null,
            countyName: venue.county?.name || "",
            stateId: venue.county?.state?._id || null,
            stateName: venue.county?.state?.name || "",
            stateAbbr: venue.county?.state?.abbreviation || "",
            cityName: venue.cityName || "",
        }));

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
