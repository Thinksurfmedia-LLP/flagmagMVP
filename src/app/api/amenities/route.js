import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Amenity from "@/models/Amenity";
import { requireAdmin } from "@/lib/apiAuth";

// GET all amenities (public - no auth needed for frontend)
export async function GET() {
    try {
        await dbConnect();
        const amenities = await Amenity.find({}).sort({ name: 1 }).lean();
        return NextResponse.json({ success: true, data: amenities });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST create amenity (admin only)
export async function POST(request) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;
        if (auth.user.role !== "admin") {
            return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
        }

        await dbConnect();
        const body = await request.json();
        const amenity = await Amenity.create({ name: body.name, icon: body.icon || "" });
        return NextResponse.json({ success: true, data: amenity }, { status: 201 });
    } catch (error) {
        if (error.code === 11000) {
            return NextResponse.json({ success: false, error: "An amenity with this name already exists" }, { status: 400 });
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
