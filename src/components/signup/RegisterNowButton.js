"use client";

import Link from "next/link";

/**
 * Register Now on an organization page — the only entry point into the
 * signup checkout (see Header.js, where the nav's own Register link was
 * removed). Goes straight to checkout — no login required to register;
 * SignupCheckout collects name/email/phone itself for a guest buyer.
 */
export default function RegisterNowButton({ orgSlug, className = "btn btn-primary" }) {
    return <Link href={`/signup?org=${orgSlug}`} className={className}>Register Now</Link>;
}
