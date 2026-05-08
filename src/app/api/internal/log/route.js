import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activityLogger";

// This route should only be called by our own middleware
export async function POST(request) {
    try {
        const authHeader = request.headers.get("authorization");
        // Use JWT_SECRET as a simple pre-shared key between middleware and this route
        const secret = process.env.JWT_SECRET || "fallback-secret-do-not-use-in-production";

        if (authHeader !== `Bearer ${secret}`) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        
        await logActivity({
            userId: body.userId,
            role: body.role,
            action: body.action,
            details: body.details,
            organization: body.organization || null,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
