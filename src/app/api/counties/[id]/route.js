import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import County from "@/models/County";
import Location from "@/models/Location";
import { requireAdmin } from "@/lib/apiAuth";

export async function PUT(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const body = await request.json();

        const county = await County.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        if (!county) return NextResponse.json({ success: false, error: "County not found" }, { status: 404 });

        return NextResponse.json({ success: true, data: county });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}

export async function DELETE(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;

        await Location.deleteMany({ county: id });
        await County.findByIdAndDelete(id);

        return NextResponse.json({ success: true, message: "County and its locations deleted" });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
