import Player from "@/models/Player";
import Team from "@/models/Team";

/**
 * Turns a captured free-agent/team Payment into the real Player/Team record
 * an organizer sees in /admin/free-agents or /admin/teams. The checkout flow
 * (src/components/signup/SignupCheckout.js) only ever writes a Payment —
 * without this, a successful registration+payment never actually shows up
 * for the organization it was made against.
 *
 * Idempotent and side-effect-safe to call on every capture (including
 * retries of an already-captured payment): it no-ops unless the payment is
 * free-agent/team, has a resolved organization, and hasn't already produced
 * a Player/Team. Never throws past its caller for a business-rule failure
 * (e.g. duplicate team name) — the payment already succeeded and must not
 * be reported as failed over a downstream record-creation problem.
 */
export async function createRegistrationRecordFromPayment(payment) {
    if (payment.player || payment.team) return;
    if (!["free-agent", "team"].includes(payment.registrationType)) return;

    if (!payment.organization) {
        console.error(`[registration] captured payment ${payment._id} has no organization — cannot create record`);
        return;
    }

    try {
        if (payment.registrationType === "free-agent") {
            const player = await Player.create({
                user: payment.user || null,
                name: payment.name,
                email: payment.email || "",
                phone: payment.phone || "",
                organization: payment.organization,
                status: "free_agent",
                requestedLeague: payment.league || null,
                location: payment.state || "",
                address: payment.address || "",
                about: payment.note || "",
            });
            payment.player = player._id;
        } else {
            const team = await Team.create({
                name: payment.teamName || `${payment.name}'s Team`,
                organization: payment.organization,
                coachName: payment.name,
                coachPhone: payment.phone || "",
                manager: payment.user || null,
                requestedLeague: payment.league || null,
                address: payment.address || "",
                description: payment.note || "",
                location: { stateAbbr: payment.state || "" },
            });
            payment.team = team._id;
        }
        await payment.save();
    } catch (err) {
        // Most likely a duplicate team name within the org (unique index on
        // {organization, name}) — the buyer's money already moved, so this
        // is logged for manual reconciliation rather than surfaced as a
        // payment failure.
        console.error(`[registration] failed to create ${payment.registrationType} record for payment ${payment._id}:`, err);
    }
}
