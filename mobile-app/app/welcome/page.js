"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// ?deleted=true — just came from /account/delete.
function AccountDeletedNotice() {
    const searchParams = useSearchParams();
    if (searchParams.get("deleted") !== "true") return null;
    return <div className="toast-message success">Your account has been deleted.</div>;
}

export default function WelcomePage() {
    const router = useRouter();

    useEffect(() => {
        fetch("/api/auth/me/mobile", { credentials: "include" })
            .then((res) => res.ok ? res.json() : null)
            .then((json) => {
                if (json?.data) router.replace("/matches");
            })
            .catch(() => {});
    }, [router]);

    return (
        <div className="wrapper">
            <div className="main-section-wrapper login-page">
                <div className="logo-area">
                    <img src="/assets/images/logo.png" alt="FlagMag" />
                </div>

                <div className="content-wrapper">
                    <Suspense fallback={null}>
                        <AccountDeletedNotice />
                    </Suspense>
                    <div className="content-area">
                        <h1>Welcome</h1>
                        <p>
                            Record live game stats, manage games and track player
                            performance — all from your phone.
                        </p>
                    </div>

                    <div className="button-area">
                        <Link href="/signup" className="btn btn-primary">
                            Get started
                        </Link>
                        <Link href="/login" className="btn btn-info-primary">
                            I already Have an account
                        </Link>
                    </div>

                    <div className="social-login-area">
                        <h5>or log in with</h5>
                        <ul>
                            <li>
                                <a href="#">
                                    <img src="/assets/images/fb.png" alt="Facebook" />
                                </a>
                            </li>
                            <li>
                                <a href="#">
                                    <img src="/assets/images/go.png" alt="Google" />
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
