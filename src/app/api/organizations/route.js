import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import { requireAdmin } from "@/lib/apiAuth";

export async function GET(request) {
    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);
        const sport = searchParams.get("sport");
        const location = searchParams.get("location");
        const search = searchParams.get("search");
        const sort = searchParams.get("sort") || "featured";

        const filter = {};
        if (sport && sport !== "All Sports") {
            filter.sport = sport;
        }
        if (location && location !== "All Locations") {
            filter.location = { $regex: location, $options: "i" };
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

        return NextResponse.json(
            { success: true, count: organizations.length, data: organizations },
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
