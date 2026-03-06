import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Award from "@/models/Award";

export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { id } = await params;

        const awards = await Award.find({ player: id })
            .sort({ createdAt: -1 })
            .lean();

        return NextResponse.json(
            {
                success: true,
                count: awards.length,
                data: awards,
            },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
