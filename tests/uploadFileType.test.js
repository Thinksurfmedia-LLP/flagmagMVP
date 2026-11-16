const test = require("node:test");
const assert = require("node:assert/strict");
const { detectImageType, extensionFor } = require("../src/lib/uploadFileType.js");

const bytes = (...b) => Buffer.from(b);

test("recognises JPEG, PNG, GIF and WebP by their file signature", () => {
    assert.equal(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0)), "image/jpeg");
    assert.equal(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0)), "image/png");
    assert.equal(detectImageType(Buffer.from("GIF89a....")), "image/gif");
    assert.equal(detectImageType(Buffer.concat([Buffer.from("RIFF"), bytes(1, 2, 3, 4), Buffer.from("WEBPVP8 ")])), "image/webp");
});

test("recognises SVG text, with or without an XML prolog", () => {
    assert.equal(detectImageType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), "image/svg+xml");
    assert.equal(detectImageType(Buffer.from('﻿<?xml version="1.0"?>\n<!-- logo -->\n<svg></svg>')), "image/svg+xml");
});

test("rejects files whose contents are not an image, whatever they are named", () => {
    assert.equal(detectImageType(Buffer.from("<html><script>alert(1)</script></html>")), null);
    assert.equal(detectImageType(Buffer.from("%PDF-1.7")), null);
    assert.equal(detectImageType(Buffer.alloc(0)), null);
});

test("extension always comes from the detected type, never the uploaded name", () => {
    assert.equal(extensionFor("image/jpeg"), ".jpg");
    assert.equal(extensionFor("image/png"), ".png");
    assert.equal(extensionFor("image/svg+xml"), ".svg");
    assert.equal(extensionFor("text/html"), null);
});
