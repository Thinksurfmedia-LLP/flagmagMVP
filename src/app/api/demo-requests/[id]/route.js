import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import DemoRequest from "@/models/DemoRequest";
import { requireAuth } from "@/lib/apiAuth";

async function requireAdmin(request) {
    const auth = await requireAuth();
    if (!auth.authorized) return { authorized: false, response: auth.response };
    const allRoles = auth.user.roles?.length ? auth.user.roles : [auth.user.role];
    if (!allRoles.includes("admin")) {
        return {
            authorized: false,
            response: NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 }),
        };
    }
    return { authorized: true, user: auth.user };
}

// PATCH — update status
export async function PATCH(request, { params }) {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { id } = await params;
        const { status } = await request.json();
        const allowed = ["new", "contacted", "scheduled", "closed"];
        if (!allowed.includes(status)) {
            return NextResponse.json({ success: false, error: "Invalid status" }, { status: 400 });
        }
        const updated = await DemoRequest.findByIdAndUpdate(id, { status }, { new: true }).lean();
        if (!updated) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
        return NextResponse.json({ success: true, data: updated });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE — remove a request
export async function DELETE(request, { params }) {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { id } = await params;
        await DemoRequest.findByIdAndDelete(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
