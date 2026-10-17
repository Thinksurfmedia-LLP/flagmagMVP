// In-memory stale-while-revalidate cache keyed by a cheap "fingerprint" of
// the underlying data (e.g. row count + latest updatedAt). Built for results
// that are expensive to compute because pulling the raw documents over the
// Atlas link is slow, while checking whether they changed is fast.
//
// - Fresh entry (same fingerprint, younger than maxAgeMs): returned as-is.
// - Stale entry: returned immediately; a recompute runs in the background.
// - No entry: the caller waits for the compute.
// - Concurrent get()s for one key share a single fingerprint check/compute.
//
// Lives in process memory, so it suits a long-running server (PM2), not
// serverless. Values are shared between callers — treat them as read-only.
// Pure CommonJS so it runs under `node --test`.

/**
 * @param {{
 *   maxAgeMs: number,
 *   maxEntries: number,
 *   onBackgroundError?: (error: unknown, key: string) => void,
 *   now?: () => number,
 * }} options
 */
function createFingerprintCache({ maxAgeMs, maxEntries, onBackgroundError = () => {}, now = Date.now }) {
    const entries = new Map(); // key -> { value, fingerprint, createdAt }
    const refreshes = new Map(); // key -> { fingerprint, promise }
    const pending = new Map(); // key -> promise of an in-progress get()

    function store(key, value, fingerprint) {
        // Re-insert so Map order tracks recency; evict the oldest past the cap.
        entries.delete(key);
        entries.set(key, { value, fingerprint, createdAt: now() });
        if (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    }

    function refresh(key, fingerprint, compute) {
        const running = refreshes.get(key);
        if (running && running.fingerprint === fingerprint) return running.promise;

        const promise = Promise.resolve()
            .then(compute)
            .then((value) => {
                store(key, value, fingerprint);
                return value;
            })
            .finally(() => {
                if (refreshes.get(key)?.promise === promise) refreshes.delete(key);
            });
        refreshes.set(key, { fingerprint, promise });
        return promise;
    }

    async function resolve(key, fingerprintFn, compute) {
        const fingerprint = await fingerprintFn();
        const cached = entries.get(key);
        if (cached && cached.fingerprint === fingerprint && now() - cached.createdAt < maxAgeMs) {
            return cached.value;
        }

        const refreshing = refresh(key, fingerprint, compute);
        if (!cached) return refreshing;

        refreshing.catch((error) => onBackgroundError(error, key));
        return cached.value;
    }

    /**
     * @template T
     * @param {string} key
     * @param {{ fingerprint: () => Promise<string>, compute: () => Promise<T> }} fns
     * @returns {Promise<T>}
     */
    function get(key, { fingerprint, compute }) {
        const inFlight = pending.get(key);
        if (inFlight) return inFlight;
        const promise = resolve(key, fingerprint, compute).finally(() => pending.delete(key));
        pending.set(key, promise);
        return promise;
    }

    /** True when get(key) would return without waiting for a full compute. */
    const has = (key) => entries.has(key);

    return { get, has };
}

module.exports = { createFingerprintCache };
