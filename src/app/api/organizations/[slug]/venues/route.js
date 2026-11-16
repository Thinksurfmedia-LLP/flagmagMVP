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

        // Look up county ObjectIds matching the org's state/county combos —
        // states and candidate counties in one parallel round trip instead
        // of one County.findOne per combo.
        const [states, counties] = await Promise.all([
            State.find({}).select("name abbreviation").lean(),
            County.find({ name: { $in: [...new Set(combos.map((c) => c.countyName))] } }).select("name state").lean(),
        ]);
        const stateMap = new Map(states.map((s) => [s.abbreviation, s._id]));
        const stateById = new Map(states.map((s) => [String(s._id), s]));

        const countyById = new Map();
        for (const { stateAbbr, countyName } of combos) {
            const stateId = stateMap.get(stateAbbr);
            if (!stateId) continue;
            const county = counties.find((c) => c.name === countyName && String(c.state) === String(stateId));
            if (county) countyById.set(String(county._id), county);
        }

        if (countyById.size === 0) {
            return NextResponse.json({ success: true, data: [] });
        }

        // County/state names come from the docs loaded above (every venue
        // returned is in one of those counties) rather than a populate.
        const venues = (await Venue.find({ county: { $in: [...countyById.values()].map((c) => c._id) } })
            .select("name slug address cityName managerName managerPhone county")
            .sort({ name: 1 })
            .lean())
            .map((v) => {
                const county = countyById.get(String(v.county));
                return { ...v, county: county && { ...county, state: stateById.get(String(county.state)) } };
            });

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
