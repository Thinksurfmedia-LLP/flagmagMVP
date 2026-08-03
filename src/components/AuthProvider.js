"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

// Endpoints where a 401 is an expected, routine outcome (anonymous visitors
// hit /api/auth/me on every page load; failed login attempts return 401 on
// purpose) — never treat those as "your session just expired".
const SESSION_PROBE_PATHS = ["/api/auth/me", "/api/auth/login", "/api/auth/login/mobile"];

function isSessionProbePath(input) {
    try {
        const url = typeof input === "string" ? input : input?.url || "";
        const path = new URL(url, window.location.origin).pathname;
        return SESSION_PROBE_PATHS.includes(path);
    } catch {
        return false;
    }
}

// Wipes everything the browser might be holding onto locally so a
// force-invalidated user actually gets a clean build, not just a login
// screen rendered from stale cached assets/state.
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

const AuthContext = createContext({
    user: null,
    loading: true,
    activeRole: null,
    setActiveRole: () => { },
    clearActiveRole: () => { },
    login: async () => { },
    logout: async () => { },
    refreshUser: async () => { },
});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeRole, setActiveRoleState] = useState(null);

    // Load persisted active role from sessionStorage when client mounts
    useEffect(() => {
        if (typeof window !== "undefined") {
            const saved = sessionStorage.getItem("flagmag-active-role");
            if (saved) setActiveRoleState(saved);
        }
    }, []);

    // Clear active role when user logs out
    useEffect(() => {
        if (!user) {
            setActiveRoleState(null);
            if (typeof window !== "undefined") sessionStorage.removeItem("flagmag-active-role");
        }
    }, [user]);

    const setActiveRole = useCallback((role) => {
        setActiveRoleState(role);
        if (typeof window !== "undefined") sessionStorage.setItem("flagmag-active-role", role);
    }, []);

    const clearActiveRole = useCallback(() => {
        setActiveRoleState(null);
        if (typeof window !== "undefined") sessionStorage.removeItem("flagmag-active-role");
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const res = await fetch("/api/auth/me");
            const data = await res.json();
            if (data.success) {
                setUser(data.data);
            } else if (data.invalidated) {
                // Was logged in, got force-invalidated — not just a cold
                // anonymous visit. Clear everything and land on a fresh login.
                setUser(null);
                await clearClientCaches();
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login?invalidated=true";
                return;
            } else {
                setUser(null);
            }
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshUser();
    }, [refreshUser]);

    // Global safety net: if any request comes back 401 (session expired or
    // invalidated server-side — e.g. a redeploy that rotated JWT_SECRET),
    // send the user to a fresh login instead of leaving them looking at a
    // raw "Authentication required" toast with no way forward.
    useEffect(() => {
        if (typeof window === "undefined" || window.__flagmagAuthFetchPatched) return;
        window.__flagmagAuthFetchPatched = true;

        const originalFetch = window.fetch.bind(window);
        window.fetch = async (...args) => {
            const response = await originalFetch(...args);
            if (
                response.status === 401 &&
                !isSessionProbePath(args[0]) &&
                !window.location.pathname.startsWith("/login")
            ) {
                setUser(null);
                let invalidated = false;
                try {
                    invalidated = !!(await response.clone().json())?.invalidated;
                } catch { }
                if (invalidated) {
                    await clearClientCaches();
                    await originalFetch("/api/auth/logout", { method: "POST" });
                    window.location.href = "/login?invalidated=true";
                } else {
                    window.location.href = "/login?expired=true";
                }
            }
            return response;
        };

        return () => {
            window.fetch = originalFetch;
            window.__flagmagAuthFetchPatched = false;
        };
    }, []);

    const login = async (email, password) => {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (data.success) {
            setUser(data.data);
            // Clear any stale active role on fresh login
            clearActiveRole();
        }
        return data;
    };

    const logout = async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        setUser(null);
        clearActiveRole();
    };

    return (
        <AuthContext.Provider value={{ user, loading, activeRole, setActiveRole, clearActiveRole, login, logout, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
