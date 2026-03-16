"use client";

import { createContext, useContext, useState, useCallback } from "react";

const ImpersonationContext = createContext(null);

export function ImpersonationProvider({ children }) {
    const [org, setOrg] = useState(null);

    const enterImpersonation = useCallback((organization) => {
        setOrg(organization);
    }, []);

    const exitImpersonation = useCallback(() => {
        setOrg(null);
    }, []);

    return (
        <ImpersonationContext.Provider value={{ org, enterImpersonation, exitImpersonation }}>
            {children}
        </ImpersonationContext.Provider>
    );
}

export function useImpersonation() {
    const ctx = useContext(ImpersonationContext);
    if (!ctx) throw new Error("useImpersonation must be used within ImpersonationProvider");
    return ctx;
}
