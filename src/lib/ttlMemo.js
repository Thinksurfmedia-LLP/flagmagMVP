// Tiny keyed async memo with a time-to-live and stale-while-revalidate:
// - fresh entry (younger than ttlMs): returned as-is;
// - stale entry: returned immediately, reloaded in the background;
// - no entry: the caller waits for the load.
// Concurrent loads of one key share a single promise. A failed load is not
// cached: with a stale entry the error goes to onError and the stale value
// keeps being served; with no entry the caller gets the error.
// Lives in process memory. Pure CommonJS so it runs under `node --test`.

/**
 * @param {{ ttlMs: number, maxEntries?: number, now?: () => number, onError?: (error: unknown, key: string) => void }} options
 */
function createTtlMemo({ ttlMs, maxEntries = Infinity, now = Date.now, onError = () => {} }) {
    const entries = new Map(); // key -> { value, at }
    const loading = new Map(); // key -> promise

    function load(key, loader) {
        const running = loading.get(key);
        if (running) return running;
        const promise = Promise.resolve()
            .then(loader)
            .then((value) => {
                entries.delete(key);
                entries.set(key, { value, at: now() });
                if (entries.size > maxEntries) entries.delete(entries.keys().next().value);
                return value;
            })
            .finally(() => loading.delete(key));
        loading.set(key, promise);
        return promise;
    }

    /**
     * @template T
     * @param {string} key
     * @param {() => Promise<T>} loader
     * @returns {Promise<T>}
     */
    async function get(key, loader) {
        const entry = entries.get(key);
        if (!entry) return load(key, loader);
        if (now() - entry.at >= ttlMs) load(key, loader).catch((error) => onError(error, key));
        return entry.value;
    }

    return { get };
}

module.exports = { createTtlMemo };
