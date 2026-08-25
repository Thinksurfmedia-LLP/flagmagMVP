import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Payment from "@/models/Payment";
import { requireAuth } from "@/lib/apiAuth";

// GET — admin only. Payments are otherwise write-only from the public side.
export async function GET() {
    const auth = await requireAuth();
    if (!auth.authorized) return auth.response;

    const allRoles = auth.user.roles?.length ? auth.user.roles : [auth.user.role];
    if (!allRoles.includes("admin")) {
        return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
    }

    try {
        await dbConnect();
        const payments = await Payment.find().sort({ createdAt: -1 }).lean();
        return NextResponse.json({ success: true, data: payments });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
