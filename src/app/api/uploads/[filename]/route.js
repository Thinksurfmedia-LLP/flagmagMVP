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

        const headers = {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
            "X-Content-Type-Options": "nosniff",
        };
        // Any logged-in user can upload an SVG, and an SVG opened directly
        // in the browser can run script on this origin. Serve it inert.
        if (ext === ".svg") {
            headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox";
        }
        return new NextResponse(buffer, { status: 200, headers });
    } catch {
        // Dev convenience: a local server pointed at the live database lists
        // uploads that only exist on the production server's disk. When
        // UPLOADS_FALLBACK_URL is set (never in production), send the browser
        // there instead of 404-ing. `safe` is a bare basename, so the redirect
        // can only ever land under that origin's /api/uploads/.
        const fallbackOrigin = getFallbackOrigin();
        if (fallbackOrigin) {
            return NextResponse.redirect(`${fallbackOrigin}/api/uploads/${encodeURIComponent(safe)}`, 302);
        }
        return NextResponse.json({ success: false, error: "File not found" }, { status: 404 });
    }
}

/** Origin of UPLOADS_FALLBACK_URL, or null when unset, invalid, or not http(s). */
function getFallbackOrigin() {
    const raw = process.env.UPLOADS_FALLBACK_URL;
    if (!raw) return null;
    try {
        const url = new URL(raw);
        if (url.protocol !== "https:" && url.protocol !== "http:") return null;
        return url.origin;
    } catch {
        return null;
    }
}
