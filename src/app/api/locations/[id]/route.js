import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Location from "@/models/Location";
import { requireAdmin } from "@/lib/apiAuth";

export async function PUT(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const body = await request.json();

        const location = await Location.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        if (!location) return NextResponse.json({ success: false, error: "Location not found" }, { status: 404 });

        return NextResponse.json({ success: true, data: location });
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
        await Location.findByIdAndDelete(id);

        return NextResponse.json({ success: true, message: "Location deleted" });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
