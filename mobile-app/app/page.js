"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SplashPage() {
    const router = useRouter();

    useEffect(() => {
        const timer = setTimeout(() => {
            router.push("/welcome");
        }, 2500);
        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="wrapper" style={{ background: "none" }}>
            <div className="landing-page">
                <div className="logo-area">
                    <img src="/assets/images/logo.png" alt="FlagMag" />
                </div>
                <div className="loader">
                    <img src="/assets/images/loader.gif" alt="Loading..." />
                </div>
            </div>
        </div>
    );
}
