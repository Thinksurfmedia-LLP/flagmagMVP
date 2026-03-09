import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import State from "@/models/State";
import County from "@/models/County";
import Venue from "@/models/Location";
import { requireAdmin } from "@/lib/apiAuth";

/**
 * GET /api/locations/by-geo?stateAbbr=XX&countyName=YY
 * Returns venues for the given state + county.
 */
export async function GET(request) {
    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const stateAbbr = searchParams.get("stateAbbr");
        const countyName = searchParams.get("countyName");

        if (!stateAbbr || !countyName) {
            return NextResponse.json({ success: false, error: "stateAbbr and countyName are required" }, { status: 400 });
        }

        const state = await State.findOne({ abbreviation: stateAbbr.toUpperCase() });
        if (!state) {
            return NextResponse.json({ success: true, data: [], countyId: null });
        }

        const countySlug = countyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const county = await County.findOne({ state: state._id, slug: countySlug });
        if (!county) {
            return NextResponse.json({ success: true, data: [], countyId: null });
        }

        const venues = await Venue.find({ county: county._id }).sort({ name: 1 }).lean();
        return NextResponse.json({ success: true, data: venues, countyId: county._id });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/locations/by-geo — Create a venue (auto-creates state/county if needed)
 */
export async function POST(request) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { stateAbbr, stateName, countyName, venueName, venueAddress, managerName, managerPhone } = await request.json();

        if (!stateAbbr || !countyName || !venueName) {
            return NextResponse.json({ success: false, error: "State, county, and venue name are required" }, { status: 400 });
        }

        // Upsert state
        let state = await State.findOne({ abbreviation: stateAbbr.toUpperCase() });
        if (!state) {
            const stateSlug = (stateName || stateAbbr).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
            state = await State.create({ name: stateName || stateAbbr, slug: stateSlug, abbreviation: stateAbbr.toUpperCase() });
        }

        // Upsert county
        const countySlug = countyName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        let county = await County.findOne({ state: state._id, slug: countySlug });
        if (!county) {
            county = await County.create({ state: state._id, name: countyName, slug: countySlug });
        }

        // Create venue
        const venueSlug = venueName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        const venue = await Venue.create({
            county: county._id,
            name: venueName,
            slug: venueSlug,
            address: venueAddress || "",
            managerName: managerName || "",
            managerPhone: managerPhone || "",
        });

        return NextResponse.json({ success: true, data: venue, countyId: county._id }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}
