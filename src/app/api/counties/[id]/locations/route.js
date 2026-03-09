import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import County from "@/models/County";
import Location from "@/models/Location";
import { requireAdmin } from "@/lib/apiAuth";

export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { id } = await params;
        const locations = await Location.find({ county: id }).sort({ name: 1 }).lean();
        return NextResponse.json({ success: true, data: locations });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;

        const county = await County.findById(id);
        if (!county) return NextResponse.json({ success: false, error: "County not found" }, { status: 404 });

        const body = await request.json();
        body.county = id;

        if (!body.slug && body.name) {
            body.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        }

        const location = await Location.create(body);
        return NextResponse.json({ success: true, data: location }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}
