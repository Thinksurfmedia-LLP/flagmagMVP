import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import Season from "@/models/Season";
import { requireAdmin } from "@/lib/apiAuth";

// GET seasons for an organization
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { slug } = await params;
        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");

        const organization = await Organization.findOne({ slug }).lean();
        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        const filter = { organization: organization._id };
        if (type) filter.type = type;

        const seasons = await Season.find(filter).sort({ startDate: -1 }).lean();

        return NextResponse.json(
            { success: true, count: seasons.length, data: seasons },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// CREATE season for an organization (admin/organizer only)
export async function POST(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { slug } = await params;

        const organization = await Organization.findOne({ slug });
        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        const body = await request.json();
        body.organization = organization._id;

        // Auto-generate slug from name if not provided
        if (!body.slug && body.name) {
            body.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        }

        const season = await Season.create(body);

        return NextResponse.json(
            { success: true, data: season },
            { status: 201 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
