// Minimal in-memory fixed-window rate limiter. No Redis/external store in
// this codebase — this is intentionally process-local (resets on restart,
// doesn't coordinate across multiple server instances). Good enough to stop
// a single client from hammering a paid third-party API (PayPal orders);
// not a substitute for a real distributed limiter if this ever runs behind
// more than one Node process.

const buckets = new Map(); // key -> { count, windowStart }

/**
 * @param {string} key - typically `${routeName}:${ip}`
 * @param {{ max: number, windowMs: number }} options
 * @returns {{ allowed: boolean, retryAfterSeconds: number }}
 */
export function checkRateLimit(key, { max, windowMs }) {
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now - bucket.windowStart >= windowMs) {
        buckets.set(key, { count: 1, windowStart: now });
        return { allowed: true, retryAfterSeconds: 0 };
    }

    if (bucket.count < max) {
        bucket.count += 1;
        return { allowed: true, retryAfterSeconds: 0 };
    }

    const retryAfterSeconds = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
    return { allowed: false, retryAfterSeconds };
}

/**
 * Best-effort client IP from a Next.js Request — this app has no proxy/CDN
 * config in the codebase to trust a specific forwarded-for hop, so this is
 * deliberately permissive (any of the common headers, falling back to a
 * shared bucket) rather than pretending to be spoof-proof.
 */
export function getClientIp(request) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) return forwardedFor.split(",")[0].trim();
    const realIp = request.headers.get("x-real-ip");
    if (realIp) return realIp;
    return "unknown";
}

// Periodically drop old buckets so this doesn't grow forever under
// sustained traffic from many distinct IPs.
const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
const MAX_BUCKET_AGE_MS = 30 * 60 * 1000;
setInterval(() => {
    const cutoff = Date.now() - MAX_BUCKET_AGE_MS;
    for (const [key, bucket] of buckets) {
        if (bucket.windowStart < cutoff) buckets.delete(key);
    }
}, SWEEP_INTERVAL_MS).unref?.();
