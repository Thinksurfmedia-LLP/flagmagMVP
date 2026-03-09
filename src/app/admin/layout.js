"use client";

import { ToastProvider } from "@/components/AdminToast";
import { ImpersonationProvider } from "@/components/ImpersonationProvider";

export default function AdminDashboardLayout({ children }) {
    return (
        <ImpersonationProvider>
            <ToastProvider>{children}</ToastProvider>
        </ImpersonationProvider>
    );
}
