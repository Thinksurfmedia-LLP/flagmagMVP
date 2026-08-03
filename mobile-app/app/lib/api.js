const BASE = "";

// Wipes local browser state so a force-logged-out statistician actually
// gets a clean build on next login, not a login screen over stale cached
// assets/state.
async function clearClientCaches() {
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
            window.location.href = "/login?invalidated=true";
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
