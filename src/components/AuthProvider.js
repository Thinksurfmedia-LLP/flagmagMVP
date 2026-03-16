"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

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
