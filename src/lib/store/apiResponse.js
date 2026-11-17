// Shared response helpers for the store API routes (server-only).
import { NextResponse } from "next/server";

export const ok = (data, init, extra = {}) => NextResponse.json({ success: true, data, ...extra }, init);

export const fail = (error, status) => NextResponse.json({ success: false, error }, { status });

export const created = (data) => ok(data, { status: 201 });

export const HEX_ID_RE = /^[a-f0-9]{24}$/i;

/** Parse the JSON body; returns null when it is missing or invalid. */
export async function readJson(request) {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

/** Map a thrown error to a response. Never exposes the error message for 500s. */
export function handleError(tag, err, duplicateMessage) {
    if (err?.code === 11000) return fail(duplicateMessage, 409);
    console.error(`[store/${tag}]`, err);
    return fail("Something went wrong", 500);
}
