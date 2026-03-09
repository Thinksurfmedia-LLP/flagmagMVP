import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import State from "@/models/State";
import { requireAdmin } from "@/lib/apiAuth";

export async function GET() {
    try {
        await dbConnect();
        const states = await State.find().sort({ name: 1 }).lean();
        return NextResponse.json({ success: true, data: states });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const body = await request.json();

        if (!body.slug && body.name) {
            body.slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        }

        const state = await State.create(body);
        return NextResponse.json({ success: true, data: state }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    }
}
