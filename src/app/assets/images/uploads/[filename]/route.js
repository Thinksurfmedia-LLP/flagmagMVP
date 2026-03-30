import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import fs from "fs";

export async function GET(request, { params }) {
    const filename = params.filename;
    if (!filename) {
        return new NextResponse("Not Found", { status: 404 });
    }

    // Optional: add basic security to prevent path traversal
    if (filename.includes("..") || filename.includes("/")) {
        return new NextResponse("Bad Request", { status: 400 });
    }

    const filePath = path.join(process.cwd(), "public", "assets", "images", "uploads", filename);

    try {
        if (!fs.existsSync(filePath)) {
            return new NextResponse("Not Found", { status: 404 });
        }

        const buffer = await readFile(filePath);
        
        // Determine content type
        const ext = path.extname(filename).toLowerCase();
        let contentType = "image/jpeg";
        if (ext === ".png") contentType = "image/png";
        else if (ext === ".webp") contentType = "image/webp";
        else if (ext === ".gif") contentType = "image/gif";
        else if (ext === ".svg") contentType = "image/svg+xml";

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=86400, must-revalidate",
            },
        });
    } catch (error) {
        console.error("Error serving uploaded image:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
