"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

export default function HeaderAuth() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.push("/");
        router.refresh();
    };

    if (loading) {
        return (
            <div className="header-btn-col">
                <span className="btn btn-info-primary" style={{ opacity: 0.5 }}>...</span>
            </div>
        );
    }

    if (user) {
        return (
            <div className="header-btn-col">
                <span className="btn btn-info-primary" style={{ cursor: "default" }}>
                    <i className="fa-solid fa-user me-1"></i> {user.name}
                </span>
                <button onClick={handleLogout} className="btn btn-primary btn-with-arrow">
                    LOGOUT <span><img src="/assets/images/btn-arrow.png" alt="" /></span>
                </button>
            </div>
        );
    }

    return (
        <div className="header-btn-col">
            <Link href="/login" className="btn btn-info-primary">LOGIN</Link>
            <Link href="#" className="btn btn-primary btn-with-arrow">
                BOOK a Demo <span><img src="/assets/images/btn-arrow.png" alt="" /></span>
            </Link>
        </div>
    );
}
