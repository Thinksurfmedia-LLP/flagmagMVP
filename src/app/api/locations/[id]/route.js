import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Venue from "@/models/Location";
import { requireAdmin } from "@/lib/apiAuth";

export async function PUT(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { id } = await params;
        const body = await request.json();

        const venue = await Venue.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        if (!venue) return NextResponse.json({ success: false, error: "Venue not found" }, { status: 404 });

        return NextResponse.json({ success: true, data: venue });
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
        await Venue.findByIdAndDelete(id);

        return NextResponse.json({ success: true, message: "Venue deleted" });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
