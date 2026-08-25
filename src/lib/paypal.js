// Thin wrapper around PayPal's REST Orders v2 API (sandbox or live, picked
// via PAYPAL_ENV). No SDK dependency — three fetch calls is all this needs.

export function getPayPalBaseUrl() {
    const env = (process.env.PAYPAL_ENV || "sandbox").toLowerCase();
    return env === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com";
}

function requireCredentials() {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        // Loud failure, same treatment as JWT_SECRET in lib/auth.js — a
        // silently-missing payment credential should never look like "it
        // just didn't work", it should say exactly why.
        throw new Error(
            "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not configured. Set them in the environment before accepting payments."
        );
    }
    return { clientId, clientSecret };
}

// Cache the OAuth2 access token in-module (mirrors the cutoff-cache style in
// lib/auth.js) so every order create/capture doesn't round-trip an extra
// token request. Refreshed a little before actual expiry.
let tokenCache = null; // { accessToken, expiresAt } | null

export async function getAccessToken() {
    const now = Date.now();
    if (tokenCache && now < tokenCache.expiresAt) {
        return tokenCache.accessToken;
    }

    const { clientId, clientSecret } = requireCredentials();
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const res = await fetch(`${getPayPalBaseUrl()}/v1/oauth2/token`, {
        method: "POST",
        headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`PayPal OAuth token request failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    tokenCache = {
        accessToken: data.access_token,
        // Refresh 60s before actual expiry so a slow request never straddles
        // the cutoff mid-call.
        expiresAt: now + Math.max(0, (data.expires_in - 60) * 1000),
    };
    return tokenCache.accessToken;
}

/**
 * Create a PayPal order for a fixed USD amount.
 * @param {{ amount: number, referenceId: string }} params
 * @returns {Promise<{ id: string, status: string }>}
 */
export async function createOrder({ amount, referenceId }) {
    const accessToken = await getAccessToken();

    const res = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            // Idempotency: PayPal returns the original order instead of
            // creating a second one for any repeat call with this same
            // referenceId. Only actually protects against a duplicate
            // submission if the CALLER reuses the same Payment._id on
            // retry — see the recent-pending-payment reuse in
            // app/api/payments/paypal/orders/route.js, which is what makes
            // that true in practice.
            "PayPal-Request-Id": referenceId,
        },
        body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [
                {
                    reference_id: referenceId,
                    amount: { currency_code: "USD", value: amount.toFixed(2) },
                },
            ],
        }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`PayPal order creation failed (${res.status}): ${JSON.stringify(data)}`);
    }
    return data;
}

/**
 * Capture a previously-created, buyer-approved PayPal order.
 * @param {string} orderId
 * @returns {Promise<object>} raw PayPal capture response
 */
export async function captureOrder(orderId) {
    const accessToken = await getAccessToken();

    const res = await fetch(`${getPayPalBaseUrl()}/v2/checkout/orders/${orderId}/capture`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(`PayPal order capture failed (${res.status}): ${JSON.stringify(data)}`);
    }
    return data;
}
