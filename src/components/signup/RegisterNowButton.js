"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

/**
 * Register Now on an organization page — the only entry point into the
 * signup checkout (see Header.js, where the nav's own Register link was
 * removed). Registration now requires an existing account, so a visitor
 * who isn't logged in gets sent to /login first, with a redirect back to
 * this exact signup URL once they sign in.
 */
export default function RegisterNowButton({ orgSlug, className = "btn btn-primary" }) {
    const { user } = useAuth();
    const signupUrl = `/signup?org=${orgSlug}`;
    // notice=register tells the login page to explain *why* it's showing up
    // instead of the signup checkout the visitor actually clicked toward.
    const href = user ? signupUrl : `/login?redirect=${encodeURIComponent(signupUrl)}&notice=register`;

    return <Link href={href} className={className}>Register Now</Link>;
}
