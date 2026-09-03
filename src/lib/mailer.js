import nodemailer from "nodemailer";

let cachedTransporter = null;

/**
 * Lazily builds (and caches) the Gmail SMTP transporter. Reused across
 * calls in the same server process instead of reconnecting per email.
 */
function getTransporter() {
    if (cachedTransporter) return cachedTransporter;

    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) {
        throw new Error("GMAIL_USER / GMAIL_APP_PASSWORD are not configured");
    }

    cachedTransporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
    });
    return cachedTransporter;
}

/**
 * Sends an email via the shared Gmail sender.
 * @param {{ to: string, subject: string, html: string, text?: string, replyTo?: string }} options
 */
export async function sendMail({ to, subject, html, text, replyTo }) {
    const transporter = getTransporter();
    await transporter.sendMail({
        from: `"FlagMag" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html,
        text,
        ...(replyTo ? { replyTo } : {}),
    });
}
