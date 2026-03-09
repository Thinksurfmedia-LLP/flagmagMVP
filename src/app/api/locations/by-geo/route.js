import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import State from "@/models/State";
import County from "@/models/County";
import Location from "@/models/Location";
import { requireAdmin } from "@/lib/apiAuth";

/**
 * GET /api/locations/by-geo?stateAbbr=CA&countyName=Los+Angeles
 * Returns locations for a given state abbreviation + county name.
 * Returns empty array if state or county doesn't exist in DB yet.
 */
export async function GET(request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const stateAbbr = searchParams.get("stateAbbr");
        const countyName = searchParams.get("countyName");

        if (!stateAbbr || !countyName) {
            return NextResponse.json({ success: true, data: [], countyId: null });
        }

        const state = await State.findOne({ abbreviation: stateAbbr.toUpperCase() }).lean();
        if (!state) {
            return NextResponse.json({ success: true, data: [], countyId: null });
        }

        const county = await County.findOne({ state: state._id, name: countyName }).lean();
        if (!county) {
            return NextResponse.json({ success: true, data: [], countyId: null });
        }

        const locations = await Location.find({ county: county._id }).sort({ name: 1 }).lean();
        return NextResponse.json({ success: true, data: locations, countyId: county._id });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/locations/by-geo
 * Body: { stateAbbr, stateName, countyName, locationName, locationAddress }
 * Finds-or-creates the State and County, then creates the Location.
 */
export async function POST(request) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { stateAbbr, stateName, countyName, locationName, locationAddress } = await request.json();

        if (!stateAbbr || !stateName || !countyName || !locationName) {
            return NextResponse.json({ success: false, error: "State, county, and location name are required" }, { status: 400 });
        }

        // Find or create State
        let state = await State.findOne({ abbreviation: stateAbbr.toUpperCase() });
        if (!state) {
            const slug = stateName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
            state = await State.create({ name: stateName, abbreviation: stateAbbr.toUpperCase(), slug });
        }

        // Find or create County
        let county = await County.findOne({ state: state._id, name: countyName });
        if (!county) {
            const slug = countyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
            county = await County.create({ state: state._id, name: countyName, slug });
        }

        // Create Location
        const locSlug = locationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const location = await Location.create({
            county: county._id,
            name: locationName,
            slug: locSlug,
            address: locationAddress || "",
        });

        return NextResponse.json({ success: true, data: location, countyId: county._id }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}
