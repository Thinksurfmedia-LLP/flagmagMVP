import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Amenity from "@/models/Amenity";
import { requireAdmin } from "@/lib/apiAuth";

// PUT update amenity (admin only)
export async function PUT(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;
        if (auth.user.role !== "admin") {
            return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
        }

        await dbConnect();
        const { id } = await params;
        const body = await request.json();
        const amenity = await Amenity.findByIdAndUpdate(id, { name: body.name, icon: body.icon ?? "" }, { new: true, runValidators: true });
        if (!amenity) return NextResponse.json({ success: false, error: "Amenity not found" }, { status: 404 });
        return NextResponse.json({ success: true, data: amenity });
    } catch (error) {
        if (error.code === 11000) {
            return NextResponse.json({ success: false, error: "An amenity with this name already exists" }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE amenity (admin only)
export async function DELETE(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;
        if (auth.user.role !== "admin") {
            return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
        }

        await dbConnect();
        const { id } = await params;
        const amenity = await Amenity.findByIdAndDelete(id);
        if (!amenity) return NextResponse.json({ success: false, error: "Amenity not found" }, { status: 404 });
        return NextResponse.json({ success: true, message: "Amenity deleted" });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
