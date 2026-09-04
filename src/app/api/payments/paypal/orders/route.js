import { NextResponse } from "next/server";
import mongoose from "mongoose";
import dbConnect from "@/lib/dbConnect";
import Payment from "@/models/Payment";
import { normalizeAmount } from "@/lib/payments/amount";
import { createOrder } from "@/lib/paypal";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

// Every POST here drives a real call against PayPal's paid API, unlike a
// plain form submission — cap it harder than the rest of this codebase's
// (rate-limit-free) public endpoints to bound PayPal quota/fraud-review
// exposure from a single abusive client.
const RATE_LIMIT = { max: 5, windowMs: 60 * 1000 };

// A client retry (double-click, flaky network) within this window reuses
// the same pending Payment row — and therefore the same PayPal
// idempotency key — instead of minting a new one each time. Without this,
// "PayPal-Request-Id" in lib/paypal.js never actually catches a duplicate,
// because a fresh Payment._id (a fresh key) is generated on every request.
const RETRY_REUSE_WINDOW_MS = 5 * 60 * 1000;

// Public — anyone can start a custom payment. Creates the Payment record
// first (status "created"), then asks PayPal for an order tied to it, so
// a PayPal-side failure still leaves an auditable local record.
export async function POST(request) {
    try {
        const { allowed, retryAfterSeconds } = checkRateLimit(`paypal-order:${getClientIp(request)}`, RATE_LIMIT);
        if (!allowed) {
            return NextResponse.json(
                { success: false, error: "Too many payment attempts. Please wait a moment and try again." },
                { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
            );
        }

        await dbConnect();
        const {
            name, email, phone, amount, note, address, state, location, teamName,
            organizationSlug, organizationName, organizationId, leagueId, leagueName, registrationType,
            teamPaymentMethod, playerCount,
        } = await request.json();

        if (!name?.trim()) {
            return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
        }
        if (!email?.trim()) {
            return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 });
        }
        if (!note?.trim()) {
            return NextResponse.json({ success: false, error: "Please add a reason for this payment" }, { status: 400 });
        }

        const amountResult = normalizeAmount(amount);
        if (!amountResult.ok) {
            return NextResponse.json({ success: false, error: amountResult.error }, { status: 400 });
        }

        const currentUser = await getCurrentUser();
        const normalizedEmail = email.trim().toLowerCase();
        const trimmedNote = note.trim();

        // Reuse a still-pending payment from the same buyer/amount/note
        // instead of creating a fresh one, so a retry gets the same PayPal
        // idempotency key rather than a new one every time.
        let payment = await Payment.findOne({
            email: normalizedEmail,
            amount: amountResult.value,
            note: trimmedNote,
            status: "created",
            createdAt: { $gte: new Date(Date.now() - RETRY_REUSE_WINDOW_MS) },
        }).sort({ createdAt: -1 });

        if (!payment) {
            payment = await Payment.create({
                name: name.trim(),
                email: normalizedEmail,
                note: trimmedNote,
                amount: amountResult.value,
                user: currentUser?.id || null,
                address: address?.trim() || "",
                state: state?.trim() || "",
                location: location?.trim() || "",
                teamName: teamName?.trim() || "",
                phone: phone?.trim() || "",
                organizationSlug: organizationSlug?.trim() || "",
                organizationName: organizationName?.trim() || "",
                leagueName: leagueName?.trim() || "",
                registrationType: ["free-agent", "team", "payment"].includes(registrationType) ? registrationType : "payment",
                organization: mongoose.isValidObjectId(organizationId) ? organizationId : null,
                league: mongoose.isValidObjectId(leagueId) ? leagueId : null,
                // Team registrations only — which of the two ways the buyer
                // chose to pay, and (only for the per-player option) how many
                // players that total was based on. Neither applies otherwise.
                teamPaymentMethod: ["deposit", "playerFees"].includes(teamPaymentMethod) ? teamPaymentMethod : null,
                playerCount: teamPaymentMethod === "playerFees" && Number(playerCount) > 0 ? Number(playerCount) : null,
            });
        }

        // Already has a live PayPal order from an earlier attempt in this
        // window — hand that back rather than asking PayPal for another.
        if (payment.paypalOrderId) {
            return NextResponse.json({ success: true, data: { orderId: payment.paypalOrderId } }, { status: 201 });
        }

        let order;
        try {
            order = await createOrder({ amount: amountResult.value, referenceId: payment._id.toString() });
        } catch (err) {
            payment.status = "failed";
            await payment.save().catch(() => {});
            // Log the real PayPal error server-side; never forward raw
            // upstream API text (can include debug/correlation data) to
            // the client.
            console.error("[payments/paypal/orders] createOrder failed:", err);
            return NextResponse.json(
                { success: false, error: "Could not start the payment. Please try again shortly." },
                { status: 502 }
            );
        }

        // Still "created" — the buyer hasn't approved anything yet at this
        // point, only a PayPal order shell exists. The capture route is
        // what moves status forward once the buyer actually approves+pays.
        payment.paypalOrderId = order.id;
        await payment.save();

        // Only ever return the PayPal order id — never the internal Payment
        // document or its Mongo _id, which has no reason to reach the client.
        return NextResponse.json({ success: true, data: { orderId: order.id } }, { status: 201 });
    } catch (error) {
        console.error("[payments/paypal/orders] unexpected error:", error);
        return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 });
    }
}
