import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import State from "@/models/State";
import County from "@/models/County";
import { requireAdmin } from "@/lib/apiAuth";

export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { id } = await params;
        const counties = await County.find({ state: id }).sort({ name: 1 }).lean();
        return NextResponse.json({ success: true, data: counties });
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

        const state = await State.findById(id);
        if (!state) return NextResponse.json({ success: false, error: "State not found" }, { status: 404 });

        const body = await request.json();
        body.state = id;

        if (!body.slug && body.name) {
            body.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        }

        const county = await County.create(body);
        return NextResponse.json({ success: true, data: county }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}
