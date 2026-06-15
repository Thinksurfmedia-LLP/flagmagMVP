import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import Venue from "@/models/Location";
import County from "@/models/County";
import State from "@/models/State";

// Public endpoint — returns all venue records in the org's operating counties
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { slug } = await params;

        const org = await Organization.findOne({ slug }).lean();
        if (!org) {
            return NextResponse.json({ success: false, error: "Organization not found" }, { status: 404 });
        }

        // Collect unique stateAbbr+countyName combos from org.locations
        const combos = [
            ...new Map(
                (org.locations || [])
                    .filter((l) => l.stateAbbr && l.countyName)
                    .map((l) => [`${l.stateAbbr}::${l.countyName}`, { stateAbbr: l.stateAbbr, countyName: l.countyName }])
            ).values(),
        ];

        if (combos.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        // Look up county ObjectIds matching the org's state/county combos
        const states = await State.find({}).lean();
        const stateMap = new Map(states.map((s) => [s.abbreviation, s._id]));

        const countyIds = [];
        for (const { stateAbbr, countyName } of combos) {
            const stateId = stateMap.get(stateAbbr);
            if (!stateId) continue;
            const county = await County.findOne({ state: stateId, name: countyName }).lean();
            if (county) countyIds.push(county._id);
        }

        if (countyIds.length === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        const venues = await Venue.find({ county: { $in: countyIds } })
            .populate({
                path: "county",
                select: "name state",
                populate: { path: "state", select: "name abbreviation" },
            })
            .sort({ name: 1 })
            .lean();

        const data = venues.map((v) => ({
            _id: v._id,
            name: v.name,
            slug: v.slug,
            address: v.address || "",
            cityName: v.cityName || "",
            countyName: v.county?.name || "",
            stateName: v.county?.state?.name || "",
            stateAbbr: v.county?.state?.abbreviation || "",
            managerName: v.managerName || "",
            managerPhone: v.managerPhone || "",
        }));

        return NextResponse.json({ success: true, data });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
