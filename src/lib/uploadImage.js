"use client";

import { compressImageForUpload } from "@/lib/compressImage";

// The one way admin screens upload an image. Every screen used to carry its
// own copy of this — most without the 1MB shrink step, several without the
// 413 check (nginx answers an oversized upload with an HTML page, so
// res.json() threw and the admin saw a vague "Upload failed" or nothing).

const SIZE_LIMIT_MESSAGE = "Upload size limit exceeded. Maximum file size is 1MB.";

async function readJson(res) {
    try {
        return await res.json();
    } catch {
        return null; // proxy error pages (413, 502, 504) aren't JSON
    }
}

function messageForStatus(status) {
    if (status === 413) return SIZE_LIMIT_MESSAGE;
    if (status === 401) return "Your session has expired. Please log in again, then retry the upload.";
    if (status >= 500) return "The server couldn't save the image. Please try again.";
    return "Upload failed. Please try again.";
}

/**
 * Shrinks (if needed) and uploads one image.
 * @param {File} file
 * @returns {Promise<string>} the stored image's URL (`/api/uploads/...`)
 * @throws {Error} with a user-facing message
 */
export async function uploadImage(file) {
    const ready = await compressImageForUpload(file);
    const fd = new FormData();
    fd.append("file", ready);
    let res;
    try {
        res = await fetch("/api/upload", { method: "POST", body: fd });
    } catch {
        throw new Error("Couldn't reach the server. Check your connection and try again.");
    }
    const data = await readJson(res);
    if (res.ok && data?.success && data.url) return data.url;
    throw new Error(data?.error || messageForStatus(res.status));
}
