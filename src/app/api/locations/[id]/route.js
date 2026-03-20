import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Venue from "@/models/Location";
import League from "@/models/League";
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

        const venue = await Venue.findById(id).select("name").lean();
        if (!venue) {
            return NextResponse.json({ success: false, error: "Venue not found" }, { status: 404 });
        }

        const referencingLeagues = await League.find({
            locations: venue.name,
        }).select("name").lean();

        if (referencingLeagues.length > 0) {
            const names = referencingLeagues.map((l) => l.name).join(", ");
            return NextResponse.json(
                {
                    success: false,
                    error: `Cannot delete this venue — it is used by ${referencingLeagues.length} league(s): ${names}. You can edit the venue instead.`,
                },
                { status: 400 }
            );
        }

        await Venue.findByIdAndDelete(id);

        return NextResponse.json({ success: true, message: "Venue deleted" });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
