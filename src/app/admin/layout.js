"use client";

import { ToastProvider } from "@/components/AdminToast";

export default function AdminDashboardLayout({ children }) {
    return <ToastProvider>{children}</ToastProvider>;
}
