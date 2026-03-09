"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

const ToastContext = createContext();

let toastId = 0;

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const timers = useRef({});

    const removeToast = useCallback((id) => {
        clearTimeout(timers.current[id]);
        delete timers.current[id];
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addToast = useCallback((message, type = "success", duration = 3000) => {
        const id = ++toastId;
        setToasts((prev) => [...prev, { id, message, type }]);
        timers.current[id] = setTimeout(() => removeToast(id), duration);
        return id;
    }, [removeToast]);

    const showSuccess = useCallback((msg) => addToast(msg, "success"), [addToast]);
    const showError = useCallback((msg) => addToast(msg, "error", 5000), [addToast]);

    return (
        <ToastContext.Provider value={{ showSuccess, showError }}>
            {children}
            <div className="admin-toast-container">
                {toasts.map((t) => (
                    <div key={t.id} className={`admin-toast admin-toast-${t.type}`}>
                        <i className={`fa-solid ${t.type === "success" ? "fa-check-circle" : "fa-exclamation-circle"}`}></i>
                        <span>{t.message}</span>
                        <button className="admin-toast-close" onClick={() => removeToast(t.id)}>
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used within ToastProvider");
    return ctx;
}
