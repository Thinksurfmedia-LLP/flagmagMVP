"use client";

// Uploads are capped at 1MB (nginx client_max_body_size + /api/upload), but a
// phone photo is usually 2–6MB, so player photos were being rejected. This
// shrinks an image in the browser until it fits — same picture, smaller file.

export const UPLOAD_MAX_BYTES = 1024 * 1024;
const TARGET_BYTES = 950 * 1024; // headroom for multipart overhead
const MAX_EDGE_STEPS = [1600, 1200, 900, 700];
const QUALITY_STEPS = [0.85, 0.75, 0.65];

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
        img.src = url;
    });
}

function encode(img, maxEdge, quality) {
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // transparent PNG areas would turn black in JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Returns `file` unchanged when it already fits under the upload limit,
 * otherwise a resized JPEG under ~950KB.
 * @param {File} file
 * @returns {Promise<File>}
 * @throws {Error} with a user-facing message when the image can't be shrunk
 */
export async function compressImageForUpload(file) {
    if (file.size <= TARGET_BYTES) return file;
    let img;
    try {
        img = await loadImage(file);
    } catch {
        throw new Error("This image format can't be resized in the browser. Please use a JPG or PNG under 1MB.");
    }
    for (const edge of MAX_EDGE_STEPS) {
        for (const quality of QUALITY_STEPS) {
            const blob = await encode(img, edge, quality);
            if (blob && blob.size <= TARGET_BYTES) {
                const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
                return new File([blob], name, { type: "image/jpeg" });
            }
        }
    }
    throw new Error("Couldn't shrink this image under 1MB. Please try a smaller photo.");
}
