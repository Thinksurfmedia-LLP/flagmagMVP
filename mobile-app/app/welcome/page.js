"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function WelcomePage() {
    const router = useRouter();

    useEffect(() => {
        fetch("/api/auth/me", { credentials: "include" })
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
