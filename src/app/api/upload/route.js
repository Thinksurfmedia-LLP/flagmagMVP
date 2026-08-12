import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/apiAuth";

export async function POST(request) {
    try {
        const auth = await requireAuth();
        if (!auth.authorized) return auth.response;

        const formData = await request.formData();
        const file = formData.get("file");

        if (!file || typeof file === "string") {
            return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
        }

        const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ success: false, error: "Invalid file type. Only JPEG, PNG, WebP, GIF, and SVG are allowed." }, { status: 400 });
        }

        // Kept at 1MB to match nginx's client_max_body_size in front of this
        // route (client decision: keep the default server limit as-is rather
        // than raising it). Anything over 1MB is actually rejected by nginx
        // before it reaches here — this check is a fallback for whenever that
        // isn't true (e.g. local dev without nginx in front).
        const maxSize = 1 * 1024 * 1024; // 1MB
        if (file.size > maxSize) {
            return NextResponse.json({ success: false, error: "Upload size limit exceeded. Maximum file size is 1MB." }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const ext = path.extname(file.name).toLowerCase() || ".jpg";
        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        const uploadPath = path.join(process.cwd(), "public", "assets", "images", "uploads", safeName);

        await writeFile(uploadPath, buffer);

        return NextResponse.json(
            { success: true, url: `/api/uploads/${safeName}` },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
