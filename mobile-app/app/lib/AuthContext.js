"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiGet, apiPost } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchUser = useCallback(async () => {
        try {
            const res = await apiGet("/api/auth/me");
            setUser(res.data || null);
        } catch {
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const login = async (email, password) => {
        const res = await apiPost("/api/auth/login/mobile", { email, password });
        setUser(res.data);
        return res;
    };

    const signup = async (data) => {
        const res = await apiPost("/api/auth/register/mobile", data);
        setUser(res.data);
        return res;
    };

    const logout = async () => {
        try {
            await apiPost("/api/auth/logout");
        } catch {
            // ignore
        }
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, signup, logout, refetch: fetchUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}
