import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import State from "@/models/State";
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

        const state = await State.findByIdAndUpdate(id, body, { new: true, runValidators: true });
        if (!state) return NextResponse.json({ success: false, error: "State not found" }, { status: 404 });

        return NextResponse.json({ success: true, data: state });
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

        const counties = await County.find({ state: id }).select("_id").lean();
        const countyIds = counties.map(c => c._id);
        await Location.deleteMany({ county: { $in: countyIds } });
        await County.deleteMany({ state: id });
        await State.findByIdAndDelete(id);

        return NextResponse.json({ success: true, message: "State and all its counties/locations deleted" });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
