// Works out what an uploaded file really is from its first bytes, so the
// upload route never trusts the browser-supplied MIME type or file name.
// (A file named "photo.html" sent as image/png used to be stored as .html.)
// CommonJS + dependency-free so it runs under `node --test`.

const EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
};

const startsWith = (buf, sig, offset = 0) =>
    buf.length >= offset + sig.length && sig.every((b, i) => buf[offset + i] === b);

const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

// SVG is text: allow a BOM, an XML prolog, comments and a doctype before <svg.
const SVG_HEAD = /^﻿?\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>]/i;

/**
 * @param {Buffer} buf file contents (only the first ~1KB is looked at)
 * @returns {string|null} the image MIME type, or null when it isn't one we accept
 */
function detectImageType(buf) {
    if (!buf || buf.length === 0) return null;
    if (startsWith(buf, [0xff, 0xd8, 0xff])) return "image/jpeg";
    if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
    if (startsWith(buf, ascii("GIF87a")) || startsWith(buf, ascii("GIF89a"))) return "image/gif";
    if (startsWith(buf, ascii("RIFF")) && startsWith(buf, ascii("WEBP"), 8)) return "image/webp";
    if (SVG_HEAD.test(buf.subarray(0, 1024).toString("utf8"))) return "image/svg+xml";
    return null;
}

/** @returns {string|null} */
function extensionFor(mimeType) {
    return EXTENSIONS[mimeType] || null;
}

module.exports = { detectImageType, extensionFor };
