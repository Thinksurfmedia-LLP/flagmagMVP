import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Payment from "@/models/Payment";
import { captureOrder } from "@/lib/paypal";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { createRegistrationRecordFromPayment } from "@/lib/registration/fromPayment";

const RATE_LIMIT = { max: 10, windowMs: 60 * 1000 };

export async function POST(request, { params }) {
    try {
        const { allowed, retryAfterSeconds } = checkRateLimit(`paypal-capture:${getClientIp(request)}`, RATE_LIMIT);
        if (!allowed) {
            return NextResponse.json(
                { success: false, error: "Too many requests. Please wait a moment and try again." },
                { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
            );
        }

        await dbConnect();
        const { orderId } = await params;

        const payment = await Payment.findOne({ paypalOrderId: orderId });
        if (!payment) {
            return NextResponse.json({ success: false, error: "Payment not found" }, { status: 404 });
        }

        // Idempotent: a duplicate capture call (double-click, browser back
        // button, retry after a flaky network response) returns the
        // already-recorded result instead of hitting PayPal a second time.
        if (payment.status === "captured") {
            // Also covers the case where a prior call captured the payment
            // but crashed/errored before the Player/Team got created below —
            // this re-checks (createRegistrationRecordFromPayment no-ops if
            // one already exists) rather than assuming it's done.
            await createRegistrationRecordFromPayment(payment);
            return NextResponse.json({ success: true, data: { status: "captured" } });
        }

        let captureData;
        try {
            captureData = await captureOrder(orderId);
        } catch (err) {
            console.error("[payments/paypal/capture] captureOrder failed:", err);
            // Two near-simultaneous capture calls for the same order can
            // both reach this point before either has written a new
            // status — PayPal only ever honors one capture, so the "losing"
            // call fails here. Re-check rather than assume: if the winner
            // already recorded success, answer this call the same way
            // instead of surfacing a spurious error for a payment that
            // actually went through.
            const latest = await Payment.findById(payment._id).select("status").lean();
            if (latest?.status === "captured") {
                return NextResponse.json({ success: true, data: { status: "captured" } });
            }
            payment.status = "failed";
            await payment.save().catch(() => {});
            return NextResponse.json(
                { success: false, error: "Payment could not be completed. Please contact support." },
                { status: 502 }
            );
        }

        const captureUnit = captureData?.purchase_units?.[0]?.payments?.captures?.[0];
        const capturedAmount = captureUnit ? Number(captureUnit.amount?.value) : null;
        const captureId = captureUnit?.id || "";
        const payerEmail = captureData?.payer?.email_address || "";

        // The amount lived on our own DB record before the buyer ever saw
        // a PayPal button (see the orders route) — re-check what PayPal
        // actually captured against it rather than trusting anything the
        // client could have tampered with in between.
        const amountMatches = capturedAmount !== null && Math.abs(capturedAmount - payment.amount) < 0.005;

        payment.paypalCaptureId = captureId;
        payment.capturedAmount = capturedAmount;
        payment.payerEmail = payerEmail;
        payment.status = captureData?.status === "COMPLETED" && amountMatches ? "captured" : "failed";
        await payment.save();

        if (payment.status === "failed") {
            return NextResponse.json(
                { success: false, error: "Payment could not be verified. Please contact support." },
                { status: 502 }
            );
        }

        await createRegistrationRecordFromPayment(payment);

        return NextResponse.json({ success: true, data: { status: "captured" } });
    } catch (error) {
        console.error("[payments/paypal/capture] unexpected error:", error);
        return NextResponse.json({ success: false, error: "Something went wrong. Please try again." }, { status: 500 });
    }
}
