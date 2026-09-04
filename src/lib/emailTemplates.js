import fs from "fs";
import path from "path";

const LOGO_PATH = path.join(process.cwd(), "public", "assets", "images", "logo.png");
const LOGO_CID = "flagmag-logo";

// Gmail (and several other webmail clients) strip/refuse to render
// `<img src="data:...">` base64 images in received mail, and a relative or
// localhost `/assets/...` URL can't be fetched by an email client at all —
// so the logo has to travel as a real inline attachment (Content-ID) that
// the HTML references as `cid:flagmag-logo`. This is the one embedding
// method every major mail client actually supports.
function getLogoAttachment() {
    if (!fs.existsSync(LOGO_PATH)) return null;
    return { filename: "logo.png", path: LOGO_PATH, cid: LOGO_CID };
}

// Shared branded shell for outbound notification emails — dark header band
// + red accent line matching the FlagMag site's color scheme (#FF1E00 on
// near-black), white content card for readability across email clients.
// Inline styles throughout since most clients strip <style> blocks.
function emailWrapper({ heading, bodyHtml, badge }) {
    const logoAttachment = getLogoAttachment();
    const html = `
<div style="background:#f4f4f5;padding:32px 16px;font-family:'DM Sans',Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 10px rgba(0,0,0,0.08);">
        <div style="background:#160f0e;padding:20px 32px;border-bottom:3px solid #FF1E00;">
            ${logoAttachment
            ? `<img src="cid:${LOGO_CID}" alt="FlagMag" height="36" style="display:block;height:36px;width:auto;border-radius:4px;" />`
            : `<span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:1px;text-transform:uppercase;">Flag<span style="color:#FF1E00;">Mag</span></span>`
        }
        </div>
        <div style="padding:32px;">
            ${badge ? `<span style="display:inline-block;background:rgba(255,30,0,0.1);color:#FF1E00;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;padding:4px 10px;border-radius:20px;margin-bottom:14px;">${badge}</span><br/>` : ""}
            <h1 style="margin:0 0 20px;font-size:22px;color:#160f0e;font-weight:800;">${heading}</h1>
            ${bodyHtml}
        </div>
        <div style="background:#f9f9fa;padding:16px 32px;border-top:1px solid #eceef0;">
            <p style="margin:0;font-size:12px;color:#9a9fa8;">Sent automatically from the FlagMag website.</p>
        </div>
    </div>
</div>`;

    return { html, attachments: logoAttachment ? [logoAttachment] : [] };
}

function fieldRow(label, value, { linkType } = {}) {
    const displayValue = value || "Not specified";
    const href = linkType === "email" ? `mailto:${value}` : linkType === "tel" ? `tel:${value.replace(/\s/g, "")}` : null;
    const valueHtml = href && value
        ? `<a href="${href}" style="color:#160f0e;text-decoration:none;">${displayValue}</a>`
        : displayValue;
    return `
        <tr>
            <td style="padding:12px 0;border-bottom:1px solid #eceef0;">
                <span style="display:block;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;color:#FF1E00;margin-bottom:4px;">${label}</span>
                <span style="display:block;font-size:15px;color:#160f0e;font-weight:600;">${valueHtml}</span>
            </td>
        </tr>`;
}

function formatPreferredDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit",
    });
}

/**
 * Notification email sent to the FlagMag team when someone submits the
 * "Book a Demo" / organization registration form.
 * @returns {{ html: string, attachments: Array }}
 */
export function demoRequestEmail(demo) {
    const rows = [
        fieldRow("Full Name", demo.fullName),
        fieldRow("Work Email", demo.workEmail, { linkType: "email" }),
        fieldRow("Phone", demo.phone, { linkType: "tel" }),
        fieldRow("Organization", demo.organizationName),
        fieldRow("Preferred Date & Time", formatPreferredDateTime(demo.preferredDateTime)),
    ].join("");

    const firstName = (demo.fullName || "").trim().split(/\s+/)[0] || "Someone";

    return emailWrapper({
        badge: "New Demo Request",
        heading: `${firstName} Sent You a Demo Request`,
        bodyHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`,
    });
}

const REGISTRATION_TYPE_LABELS = {
    "free-agent": "Free Agent",
    team: "Team",
    payment: "Payment",
};

// Subject-line phrasing differs slightly from REGISTRATION_TYPE_LABELS above
// ("payment" reads as "Custom Payment" here, not "Payment Registration").
const REGISTRATION_SUBJECT_LABELS = {
    "free-agent": "Free Agent Registration",
    team: "Team Registration",
    payment: "Custom Payment",
};

/**
 * Subject line for the registration notification email — e.g.
 * "Flagmag | United Flag Football - Team Registration".
 */
export function registrationSubject(payment) {
    const typeLabel = REGISTRATION_SUBJECT_LABELS[payment.registrationType] || "Registration";
    return `Flagmag | ${payment.organizationName || "Organization"} - ${typeLabel}`;
}

function formatCurrency(amount, currency) {
    if (amount === null || amount === undefined) return "";
    try {
        return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(amount);
    } catch {
        return `$${Number(amount).toFixed(2)}`;
    }
}

/**
 * Notification email sent to the FlagMag team when a captured PayPal
 * payment completes a signup (org registration, team, or free-agent).
 * @param {object} payment - A captured Payment document.
 * @returns {{ html: string, attachments: Array }}
 */
export function registrationEmail(payment) {
    // Prefer what PayPal actually captured over the originally-requested
    // amount — that's the number that actually landed, and the capture
    // route already verifies the two match before marking this "captured".
    const amountPaid = payment.capturedAmount ?? payment.amount;
    const locationParts = [payment.location, payment.state].filter(Boolean).join(", ");

    const rows = [
        fieldRow("Full Name", payment.name),
        fieldRow("Email", payment.email, { linkType: "email" }),
        fieldRow("Phone", payment.phone, { linkType: "tel" }),
        fieldRow("Registration Type", REGISTRATION_TYPE_LABELS[payment.registrationType] || payment.registrationType),
        ...(payment.teamName ? [fieldRow("Team Name", payment.teamName)] : []),
        fieldRow("Organization", payment.organizationName),
        ...(payment.leagueName ? [fieldRow("League", payment.leagueName)] : []),
        ...(payment.address ? [fieldRow("Address", payment.address)] : []),
        ...(locationParts ? [fieldRow("Location", locationParts)] : []),
        ...(payment.note ? [fieldRow("Note", payment.note)] : []),
        ...(payment.teamPaymentMethod === "deposit" ? [fieldRow("Payment For", "Team Deposit")] : []),
        ...(payment.teamPaymentMethod === "playerFees" ? [fieldRow("Payment For", `Team Fee (${payment.playerCount || 0} players)`)] : []),
        fieldRow("Amount Paid", formatCurrency(amountPaid, payment.currency)),
    ].join("");

    const firstName = (payment.name || "").trim().split(/\s+/)[0] || "Someone";
    const heading = payment.registrationType === "free-agent" ? `${firstName} Registered for Free Agent`
        : payment.registrationType === "team" ? `${firstName} Registered for Team`
        : `${firstName} sent you custom payment`;

    return emailWrapper({
        badge: "New Registration",
        heading,
        bodyHtml: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`,
    });
}
