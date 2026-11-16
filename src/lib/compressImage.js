"use client";

// Uploads are capped at 1MB (nginx client_max_body_size + /api/upload), but a
// phone photo is usually 2–6MB, so player photos were being rejected. This
// shrinks an image in the browser until it fits — same picture, smaller file.
//
// It also converts formats the server doesn't accept (e.g. iPhone HEIC, which
// Safari can decode) to JPEG, and keeps transparency for PNG/WebP/GIF logos
// instead of flattening them onto white.

export const UPLOAD_MAX_BYTES = 1024 * 1024;
const TARGET_BYTES = 950 * 1024; // headroom for multipart overhead
const MAX_EDGE_STEPS = [1600, 1200, 900, 700];
const QUALITY_STEPS = [0.85, 0.75, 0.65];

// Must match the allow-list in src/app/api/upload/route.js.
export const UPLOAD_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const TRANSPARENT_TYPES = new Set(["image/png", "image/webp", "image/gif"]);

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
        img.src = url;
    });
}

function encode(img, maxEdge, type, quality) {
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (type === "image/jpeg") {
        ctx.fillStyle = "#fff"; // transparent areas would turn black in JPEG
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

const EXTENSIONS = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

function toFile(blob, originalName) {
    const base = (originalName || "image").replace(/\.[^.]+$/, "");
    return new File([blob], base + EXTENSIONS[blob.type], { type: blob.type });
}

// Output formats to try, best first. Transparent sources try WebP then PNG
// (both keep the alpha channel) before giving up and flattening to JPEG.
// A browser that can't encode WebP (older Safari) returns PNG instead —
// the blob's real type is checked, never assumed.
function candidateTypes(sourceType) {
    return TRANSPARENT_TYPES.has(sourceType) ? ["image/webp", "image/png", "image/jpeg"] : ["image/jpeg"];
}

async function shrink(img, file) {
    for (const type of candidateTypes(file.type)) {
        for (const edge of MAX_EDGE_STEPS) {
            for (const quality of QUALITY_STEPS) {
                const blob = await encode(img, edge, type, quality);
                if (blob && blob.type === type && blob.size <= TARGET_BYTES) return toFile(blob, file.name);
                if (type === "image/png") break; // PNG ignores quality — only size steps matter
            }
        }
    }
    return null;
}

/**
 * Returns `file` unchanged when the server already accepts it as-is,
 * otherwise a re-encoded copy under ~950KB.
 * @param {File} file
 * @returns {Promise<File>}
 * @throws {Error} with a user-facing message when the image can't be used
 */
export async function compressImageForUpload(file) {
    const acceptedAsIs = UPLOAD_ACCEPTED_TYPES.includes(file.type);
    if (acceptedAsIs && file.size <= TARGET_BYTES) return file;
    if (file.type === "image/svg+xml") {
        // Vector files can't be shrunk by re-encoding without rasterising them.
        throw new Error("This SVG is over 1MB. Please use a smaller SVG, or a PNG/JPG instead.");
    }
    let img;
    try {
        img = await loadImage(file);
    } catch {
        throw new Error(acceptedAsIs
            ? "This image can't be resized in the browser. Please use a JPG or PNG under 1MB."
            : "This image format isn't supported. Please use a JPG, PNG, WebP or GIF.");
    }
    const shrunk = await shrink(img, file);
    if (shrunk) return shrunk;
    throw new Error("Couldn't shrink this image under 1MB. Please try a smaller photo.");
}
