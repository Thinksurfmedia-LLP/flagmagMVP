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
//
// Optional `persist` adds a second level that survives restarts: on a memory
// miss the stored entry is loaded and treated exactly like a memory entry
// (fresh → returned; stale → returned while recomputing), and every compute
// is saved. Persistence is best-effort — its failures go to onBackgroundError
// and the cache falls back to computing.

/**
 * @param {{
 *   maxAgeMs: number,
 *   maxEntries: number,
 *   onBackgroundError?: (error: unknown, key: string) => void,
 *   now?: () => number,
 *   persist?: {
 *     load: (key: string) => Promise<{ value: unknown, fingerprint: string, savedAt: number } | null>,
 *     save: (key: string, value: unknown, fingerprint: string, savedAt: number) => Promise<void>,
 *   },
 * }} options
 */
function createFingerprintCache({ maxAgeMs, maxEntries, onBackgroundError = () => {}, now = Date.now, persist = null }) {
    const entries = new Map(); // key -> { value, fingerprint, createdAt }
    const refreshes = new Map(); // key -> { fingerprint, promise }
    const pending = new Map(); // key -> promise of an in-progress get()

    function store(key, value, fingerprint, createdAt = now()) {
        // Re-insert so Map order tracks recency; evict the oldest past the cap.
        entries.delete(key);
        entries.set(key, { value, fingerprint, createdAt });
        if (entries.size > maxEntries) entries.delete(entries.keys().next().value);
    }

    async function loadPersisted(key) {
        if (!persist) return null;
        try {
            const saved = await persist.load(key);
            if (!saved) return null;
            store(key, saved.value, saved.fingerprint, saved.savedAt);
            return entries.get(key);
        } catch (error) {
            onBackgroundError(error, key);
            return null;
        }
    }

    function savePersisted(key, value, fingerprint) {
        if (!persist) return;
        Promise.resolve()
            .then(() => persist.save(key, value, fingerprint, now()))
            .catch((error) => onBackgroundError(error, key));
    }

    function refresh(key, fingerprint, compute) {
        const running = refreshes.get(key);
        if (running && running.fingerprint === fingerprint) return running.promise;

        const promise = Promise.resolve()
            .then(compute)
            .then((value) => {
                store(key, value, fingerprint);
                savePersisted(key, value, fingerprint);
                return value;
            })
            .finally(() => {
                if (refreshes.get(key)?.promise === promise) refreshes.delete(key);
            });
        refreshes.set(key, { fingerprint, promise });
        return promise;
    }

    async function resolve(key, fingerprintFn, compute) {
        const [fingerprint, cached] = await Promise.all([
            fingerprintFn(),
            entries.get(key) || loadPersisted(key),
        ]);
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
