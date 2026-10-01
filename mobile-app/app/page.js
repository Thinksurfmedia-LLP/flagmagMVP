"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SplashPage() {
    const router = useRouter();

    useEffect(() => {
        const timer = setTimeout(async () => {
            // Every launch checks the STATS-app session (me/mobile — the
            // generic /api/auth/me doesn't report sessionEnded). If a
            // login existed but has ended (expired / nightly logout), go
            // straight to sign-in with a message — they can't record without it.
            try {
                const res = await fetch("/api/auth/me/mobile", {
                    credentials: "include",
                });
                const json = await res.json().catch(() => null);
                if (res.ok && json?.data) {
                    router.replace("/matches");
                    return;
                }
                if (json?.sessionEnded || json?.invalidated) {
                    router.replace("/login?expired=true");
                    return;
                }
            } catch {
                // network error — fall through to welcome
            }
            router.replace("/welcome");
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
