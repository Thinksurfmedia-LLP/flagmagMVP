import { NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
};

export async function GET(request, { params }) {
    const { filename } = await params;

    // Prevent path traversal
    const safe = path.basename(filename);
    const filePath = path.join(process.cwd(), "public", "assets", "images", "uploads", safe);

    try {
        const buffer = await fs.readFile(filePath);
        const ext = path.extname(safe).toLowerCase();
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch {
        return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
    }
}
