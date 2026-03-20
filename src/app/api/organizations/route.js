import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import Season from "@/models/Season";
import League from "@/models/League";
import Player from "@/models/Player";
import { requireAdmin } from "@/lib/apiAuth";

export async function GET(request) {
    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);
        const sport = searchParams.get("sport");
        const location = searchParams.get("location");
        const category = searchParams.get("category");
        const search = searchParams.get("search");
        const sort = searchParams.get("sort") || "featured";
        const filtersOnly = searchParams.get("filtersOnly");

        // Return distinct filter options
        if (filtersOnly === "true") {
            const orgs = await Organization.find({}).select("locations.cityName locations.countyName locations.stateAbbr locations.locationName sport categories").lean();
            const citySet = new Set();
            for (const org of orgs) {
                for (const loc of org.locations || []) {
                    const city = loc.cityName || loc.countyName;
                    if (city) citySet.add(city);
                }
            }
            const sportSet = new Set();
            const categorySet = new Set();
            for (const org of orgs) {
                if (org.sport) sportSet.add(org.sport);
                for (const cat of org.categories || []) categorySet.add(cat);
            }
            return NextResponse.json({
                success: true,
                data: {
                    locations: [...citySet].sort((a, b) => a.localeCompare(b)),
                    sports: [...sportSet].sort((a, b) => a.localeCompare(b)),
                    categories: [...categorySet].sort((a, b) => a.localeCompare(b)),
                },
            });
        }

        const filter = {};
        if (sport) {
            filter.sport = sport;
        }
        if (location) {
            filter.$or = [
                { "locations.cityName": location },
                { "locations.countyName": location },
            ];
        }
        if (category) {
            filter.categories = category;
        }
        if (search) {
            filter.name = { $regex: search, $options: "i" };
        }

        let sortOption = {};
        switch (sort) {
            case "a-z": sortOption = { name: 1 }; break;
            case "z-a": sortOption = { name: -1 }; break;
            case "rating": sortOption = { rating: -1 }; break;
            default: sortOption = { createdAt: -1 };
        }

        const organizations = await Organization.find(filter).sort(sortOption).lean();

        // Attach season and player counts
        const orgIds = organizations.map(o => o._id);
        const [seasonCounts, leagueCounts, playerCounts] = await Promise.all([
            Season.aggregate([
                { $match: { organization: { $in: orgIds } } },
                { $group: { _id: "$organization", count: { $sum: 1 } } },
            ]),
            League.aggregate([
                { $match: { organization: { $in: orgIds } } },
                { $group: { _id: "$organization", count: { $sum: 1 } } },
            ]),
            Player.aggregate([
                { $match: { organization: { $in: orgIds } } },
                { $group: { _id: "$organization", count: { $sum: 1 } } },
            ]),
        ]);
        const seasonMap = Object.fromEntries(seasonCounts.map(r => [r._id.toString(), r.count]));
        const leagueMap = Object.fromEntries(leagueCounts.map(r => [r._id.toString(), r.count]));
        const playerMap = Object.fromEntries(playerCounts.map(r => [r._id.toString(), r.count]));
        const enriched = organizations.map(o => ({
            ...o,
            seasonCount: seasonMap[o._id.toString()] || 0,
            leagueCount: leagueMap[o._id.toString()] || 0,
            playerCount: playerMap[o._id.toString()] || 0,
        }));

        return NextResponse.json(
            { success: true, count: enriched.length, data: enriched },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// CREATE organization (admin/organizer only)
export async function POST(request) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const body = await request.json();

        // Auto-generate slug from name if not provided
        if (!body.slug && body.name) {
            body.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        }

        const organization = await Organization.create(body);

        return NextResponse.json(
            { success: true, data: organization },
            { status: 201 }
        );
    } catch (error) {
        if (error.code === 11000) {
            return NextResponse.json(
                { success: false, error: "An organization with this slug already exists" },
                { status: 409 }
            );
        }
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
