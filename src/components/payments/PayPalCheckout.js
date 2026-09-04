"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

/**
 * Renders PayPal's hosted Buttons for a fixed amount plus the rest of the
 * form's fields, already collected by the parent. The amount travels to the
 * server only at order-creation time — PayPal's UI itself never lets the
 * buyer edit it.
 */
export default function PayPalCheckout({
    name,
    email,
    phone,
    amount,
    note,
    address,
    state,
    location,
    teamName,
    organizationSlug,
    organizationName,
    organizationId,
    leagueId,
    leagueName,
    registrationType,
    teamPaymentMethod,
    playerCount,
    onSuccess,
    onError,
}) {
    const containerRef = useRef(null);
    const buttonsInstanceRef = useRef(null);
    const [sdkReady, setSdkReady] = useState(false);
    const [status, setStatus] = useState("idle"); // idle | processing | error

    const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

    // next/script only ever loads a given `src` once per page and only
    // fires `onLoad` for whichever mount actually triggered that load.
    // PayPalCheckout unmounts/remounts as `requiredFilled` flips (e.g.
    // switching registration type clears teamName, then filling it back in
    // re-mounts this component) — a *second* mount whose script was already
    // loaded by an earlier one would otherwise wait forever for an onLoad
    // that's never coming again, leaving the button area silently blank.
    // Checking window.paypal directly on mount catches that case.
    useEffect(() => {
        if (window.paypal) setSdkReady(true);
    }, []);

    // The parent (CustomPaymentForm) passes new onSuccess/onError function
    // literals on every render — e.g. on every keystroke in an unrelated
    // field, since setError("") in its handleChange re-renders it. Reading
    // them through a ref (updated on every render, but not part of the
    // effect's dependency array) means an unrelated parent re-render no
    // longer tears down and re-renders the PayPal Buttons widget; only an
    // actual change to name/email/amount/note does.
    const callbacksRef = useRef({ onSuccess, onError });
    callbacksRef.current = { onSuccess, onError };

    // Same rationale as callbacksRef, extended to every order-detail field:
    // typing in ANY sibling field (team name, address, notes...) re-renders
    // this component with new prop values every keystroke. Reading them
    // through a ref instead of closing over them directly means the effect
    // below never needs those values in its dependency array, so the PayPal
    // Buttons widget mounts once and stays put instead of being torn down
    // and re-rendered (and briefly disappearing, or failing to reappear if
    // a render/close pair overlaps) on every character typed.
    const fieldsRef = useRef();
    fieldsRef.current = {
        name, email, phone, amount, note, address, state, location, teamName,
        organizationSlug, organizationName, organizationId, leagueId, leagueName, registrationType,
        teamPaymentMethod, playerCount,
    };

    useEffect(() => {
        if (!sdkReady || !window.paypal || !containerRef.current) return;

        // React 19 strict-mode double-invokes effects in dev — without an
        // explicit close(), a second Buttons instance renders into the same
        // container and the buyer sees two PayPal buttons stacked.
        containerRef.current.innerHTML = "";

        const buttons = window.paypal.Buttons({
            style: { layout: "vertical", color: "gold", shape: "pill", label: "pay" },
            createOrder: async () => {
                setStatus("processing");
                const res = await fetch("/api/payments/paypal/orders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(fieldsRef.current),
                });
                const data = await res.json();
                if (!data.success) {
                    setStatus("error");
                    callbacksRef.current.onError?.(data.error || "Could not start payment");
                    throw new Error(data.error || "Could not start payment");
                }
                return data.data.orderId;
            },
            onApprove: async (data) => {
                try {
                    const res = await fetch(`/api/payments/paypal/orders/${data.orderID}/capture`, {
                        method: "POST",
                    });
                    const result = await res.json();
                    if (!result.success) {
                        setStatus("error");
                        callbacksRef.current.onError?.(result.error || "Payment could not be completed");
                        return;
                    }
                    setStatus("idle");
                    callbacksRef.current.onSuccess?.();
                } catch (err) {
                    setStatus("error");
                    callbacksRef.current.onError?.("Payment could not be completed. Please contact support.");
                }
            },
            onCancel: () => setStatus("idle"),
            onError: () => {
                setStatus("error");
                callbacksRef.current.onError?.("PayPal ran into a problem. Please try again.");
            },
        });

        buttons.render(containerRef.current);
        buttonsInstanceRef.current = buttons;

        return () => {
            buttonsInstanceRef.current?.close?.();
        };
    }, [sdkReady]);

    if (!clientId) {
        return (
            <div className="alert alert-danger py-2" role="alert" style={{ fontSize: 14 }}>
                Payments aren&apos;t configured yet. Please contact the site admin.
            </div>
        );
    }

    return (
        <div>
            <Script
                src={`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD`}
                strategy="afterInteractive"
                onLoad={() => setSdkReady(true)}
            />
            <div ref={containerRef} />
            {status === "processing" && (
                <p style={{ fontSize: 13, color: "#8b90a0", marginTop: 8 }}>Preparing payment...</p>
            )}
        </div>
    );
}
