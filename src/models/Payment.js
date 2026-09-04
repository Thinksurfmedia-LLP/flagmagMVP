import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true, lowercase: true },
        phone: { type: String, trim: true, default: "" },
        note: { type: String, trim: true, default: "" },
        // Optional contact/context fields collected on the custom-payment
        // form — none of these affect payment processing, purely for
        // whoever reconciles payments in the admin list.
        address: { type: String, trim: true, default: "" },
        state: { type: String, trim: true, default: "" },
        location: { type: String, trim: true, default: "" },
        teamName: { type: String, trim: true, default: "" },
        // Denormalized org/league labels — same rationale as state/location
        // above: display-only for the admin registrations list, not a FK,
        // since the signup form already has the resolved name in hand.
        organizationSlug: { type: String, trim: true, default: "" },
        organizationName: { type: String, trim: true, default: "" },
        leagueName: { type: String, trim: true, default: "" },
        registrationType: {
            type: String,
            enum: ["free-agent", "team", "payment"],
            default: "payment",
        },
        // Team registrations only — which of the two ways the buyer paid
        // (a flat team deposit vs. a per-player total) and, only for the
        // per-player option, how many players that total was based on.
        teamPaymentMethod: {
            type: String,
            enum: ["deposit", "playerFees", null],
            default: null,
        },
        playerCount: { type: Number, default: null },
        // Actual FKs (as opposed to the display-only strings above) — set
        // at order-creation time from the org/league the signup form
        // already had resolved. Lets the admin/organizer Registrations
        // list (GET /api/payments) scope results to one organization.
        // Registering doesn't auto-create a Player/Team — the organizer
        // reviews this list and creates the record themselves.
        organization: { type: mongoose.Schema.Types.ObjectId, ref: "Organization", default: null },
        league: { type: mongoose.Schema.Types.ObjectId, ref: "League", default: null },
        // Requested amount, validated server-side (see lib/payments/amount.js)
        // before this document is created. Authoritative for the capture
        // step — never trust a client-supplied amount at capture time.
        amount: { type: Number, required: true, min: 1 },
        currency: { type: String, default: "USD" },
        provider: { type: String, default: "paypal" },
        paypalOrderId: { type: String, unique: true, sparse: true },
        paypalCaptureId: { type: String, default: "" },
        // What PayPal actually reports as captured — compared against
        // `amount` at capture time so a mismatch is visible, not silent.
        capturedAmount: { type: Number, default: null },
        payerEmail: { type: String, default: "" },
        status: {
            type: String,
            enum: ["created", "approved", "captured", "failed", "cancelled"],
            default: "created",
        },
        // Set when the payer was logged in at the time of payment.
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: true }
);

function getPaymentModel() {
    const existing = mongoose.models.Payment;
    // Dev HMR guard, same rationale as Team.js/Player.js — rebuild rather
    // than silently drop writes to a field the cached model doesn't know.
    const hasNewFields = [
        "address", "state", "location", "teamName", "phone",
        "organizationSlug", "registrationType", "organization", "league",
        "teamPaymentMethod", "playerCount",
    ].every((field) => existing?.schema.path(field));
    if (existing && !hasNewFields) {
        delete mongoose.models.Payment;
    }
    return mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);
}

export default getPaymentModel();
