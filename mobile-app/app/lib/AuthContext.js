"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiGet, apiPost } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // True when there WAS a login but it's gone (expired, or the mandatory
    // nightly logout) — pages then say "your session ended" on the login
    // screen instead of showing it like a first visit.
    const [sessionEnded, setSessionEnded] = useState(false);

    const fetchUser = useCallback(async () => {
        try {
            const res = await apiGet("/api/auth/me/mobile");
            setUser(res.data || null);
            setSessionEnded(false);
        } catch (err) {
            setUser(null);
            setSessionEnded(Boolean(err?.data?.sessionEnded || err?.data?.invalidated));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    // A phone often keeps the stats app open for days, so the session was
    // only ever checked on first load. Re-check whenever the app comes back
    // to the foreground: that renews the session cookie (server-side sliding
    // renewal, see src/lib/auth.js) and, if it has expired, surfaces it now —
    // before a whole game is scored — instead of at "End Game".
    useEffect(() => {
        const onVisible = () => { if (document.visibilityState === "visible") fetchUser(); };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, [fetchUser]);

    const login = async (email, password) => {
        const res = await apiPost("/api/auth/login/mobile", { email, password });
        setUser(res.data);
        setSessionEnded(false);
        return res;
    };

    const signup = async (data) => {
        const res = await apiPost("/api/auth/register/mobile", data);
        setUser(res.data);
        return res;
    };

    const logout = async () => {
        try {
            await apiPost("/api/auth/logout/mobile");
        } catch {
            // ignore
        }
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, sessionEnded, login, signup, logout, refetch: fetchUser }}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Login URL for a page that needs a signed-in user: brings them back to
 * `next` afterwards and, if their session ended, says so on the login page.
 */
export function loginPath(next, sessionEnded) {
    const params = new URLSearchParams();
    if (sessionEnded) params.set("expired", "true");
    if (next) params.set("next", next);
    const qs = params.toString();
    return qs ? `/login?${qs}` : "/login";
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
