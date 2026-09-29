const BASE = "";

// crypto.randomUUID() only exists in a "secure context" — HTTPS, or
// http://localhost specifically. A statistician testing over the LAN
// (http://192.168.x.x:3001, same as a real phone hitting the same network
// as the dev machine) is NOT a secure context, so the API is simply absent
// there and throws "crypto.randomUUID is not a function". Idempotency keys
// only need to be unique, not cryptographically random, so this fallback
// works everywhere the real one doesn't.
export function generateId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

// Wipes local browser state so a force-logged-out statistician actually
// gets a clean build on next login, not a login screen over stale cached
// assets/state.
async function clearClientCaches() {
    console.log(`[flagmag] Triggered force logout at ${new Date().toLocaleTimeString()} — clearing caches, redirecting to login`);
    try { sessionStorage.clear(); } catch { }
    try { localStorage.clear(); } catch { }
    if (typeof caches !== "undefined") {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
        } catch { }
    }
    if (typeof navigator !== "undefined" && navigator.serviceWorker) {
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((reg) => reg.unregister()));
        } catch { }
    }
}

async function request(method, path, body) {
    const opts = {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE}${path}`, opts);
    const json = await res.json();
    if (!res.ok) {
        // Distinguish "force-invalidated" from a routine "not logged in
        // yet" 401 - every mobile-app API call funnels through here, so
        // this is the one place that needs to catch it.
        if (json.invalidated) {
            await clearClientCaches();
            try {
                await fetch(`${BASE}/api/auth/logout/mobile`, { method: "POST", credentials: "include" });
            } catch { }
            // Keep ?next so they land back where they were after signing in.
            const here = window.location.pathname.startsWith("/login") ? "" : window.location.pathname + window.location.search;
            window.location.href = `/login?invalidated=true${here ? `&next=${encodeURIComponent(here)}` : ""}`;
        } else if (res.status === 401 && !path.startsWith("/api/auth/") && typeof window !== "undefined"
            && !window.location.pathname.startsWith("/login")) {
            // Session simply expired (not force-invalidated). Used to surface
            // only as a bare "Authentication required" toast on End Game —
            // plays record without auth, so that was the first call to fail.
            // Send them to sign in and straight back to this game; nothing is
            // lost, every play is already saved server-side.
            const next = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login?expired=true&next=${next}`;
        }
        const err = new Error(json.error || "Request failed");
        err.data = json;
        throw err;
    }
    return json;
}

export const apiGet = (path) => request("GET", path);
export const apiPost = (path, body) => request("POST", path, body);
export const apiPut = (path, body) => request("PUT", path, body);
export const apiDelete = (path) => request("DELETE", path);
