import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/apiAuth";
import { detectImageType, extensionFor } from "@/lib/uploadFileType";

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

        // The stored type and extension come from the file's actual contents,
        // not the browser-supplied type/name (which the client controls).
        const detectedType = detectImageType(buffer);
        if (!detectedType) {
            return NextResponse.json({ success: false, error: "This file isn't a valid image. Please use a JPG, PNG, WebP, GIF or SVG." }, { status: 400 });
        }

        const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extensionFor(detectedType)}`;
        const uploadDir = path.join(process.cwd(), "public", "assets", "images", "uploads");
        // A fresh checkout/deploy may not have the folder yet — without this
        // every upload failed with a bare ENOENT 500.
        await mkdir(uploadDir, { recursive: true });
        await writeFile(path.join(uploadDir, safeName), buffer);

        return NextResponse.json(
            { success: true, url: `/api/uploads/${safeName}` },
            { status: 200 }
        );
    } catch (error) {
        console.error("Image upload failed:", error);
        return NextResponse.json({ success: false, error: "The server couldn't save the image. Please try again." }, { status: 500 });
    }
}
