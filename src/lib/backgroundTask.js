import { after } from "next/server";

// Self-heal passes (roster/status reconcile, free-agent user sync) can take
// ~10s on a large org over the Atlas link. Running them inside a GET makes
// every page load wait on them, so they run after the response is sent,
// at most once per key per interval. Fixes show up on the next load.
// In-process state: fine under PM2 (one long-running server), not serverless.
const lastRunAt = new Map();

/**
 * Schedule `task` to run after the current response, unless it already ran
 * (or is running) for `key` within `intervalMs`. Call only inside a request.
 * @param {string} key
 * @param {number} intervalMs
 * @param {() => Promise<unknown>} task
 */
export function runAfterResponseThrottled(key, intervalMs, task) {
    const last = lastRunAt.get(key);
    if (last && Date.now() - last < intervalMs) return;
    lastRunAt.set(key, Date.now());
    after(async () => {
        try {
            await task();
        } catch (error) {
            // Let the next request retry instead of waiting out the interval.
            lastRunAt.delete(key);
            console.error(`[background] ${key} failed:`, error);
        }
    });
}
