import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import DemoRequest from "@/models/DemoRequest";
import { requireAuth } from "@/lib/apiAuth";
import { sendMail } from "@/lib/mailer";

const PERSONAL_EMAIL_DOMAINS = [
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
    "icloud.com", "me.com", "mac.com", "live.com", "msn.com",
    "protonmail.com", "mail.com", "inbox.com", "ymail.com",
];

function isPersonalEmail(email) {
    const domain = email.split("@")[1]?.toLowerCase();
    return PERSONAL_EMAIL_DOMAINS.includes(domain);
}

// POST — public (anyone can submit a demo request)
export async function POST(request) {
    try {
        await dbConnect();
        const body = await request.json();
        const { fullName, workEmail, phone, organizationName, preferredDateTime, agreedToContact } = body;

        if (!fullName?.trim()) return NextResponse.json({ success: false, error: "Full name is required" }, { status: 400 });
        if (!workEmail?.trim()) return NextResponse.json({ success: false, error: "Work email is required" }, { status: 400 });
        if (isPersonalEmail(workEmail.trim())) return NextResponse.json({ success: false, error: "Please use a work email address" }, { status: 400 });
        if (!phone?.trim()) return NextResponse.json({ success: false, error: "Phone number is required" }, { status: 400 });
        if (!organizationName?.trim()) return NextResponse.json({ success: false, error: "Organization name is required" }, { status: 400 });
        if (!agreedToContact) return NextResponse.json({ success: false, error: "You must agree to be contacted" }, { status: 400 });

        const demo = await DemoRequest.create({
            fullName: fullName.trim(),
            workEmail: workEmail.trim().toLowerCase(),
            phone: phone.trim(),
            organizationName: organizationName.trim(),
            preferredDateTime: preferredDateTime?.trim() || "",
            agreedToContact: true,
        });

        // Best-effort notification — a mail hiccup should never fail the
        // submission itself; the request is already safely stored above.
        try {
            await sendMail({
                to: process.env.DEMO_REQUEST_NOTIFY_EMAIL || process.env.GMAIL_USER,
                replyTo: demo.workEmail,
                subject: `New demo request — ${demo.organizationName}`,
                html: `
                    <h2>New Demo Request</h2>
                    <p><strong>Full Name:</strong> ${demo.fullName}</p>
                    <p><strong>Work Email:</strong> ${demo.workEmail}</p>
                    <p><strong>Phone:</strong> ${demo.phone}</p>
                    <p><strong>Organization:</strong> ${demo.organizationName}</p>
                    <p><strong>Preferred Date &amp; Time:</strong> ${demo.preferredDateTime || "Not specified"}</p>
                `,
                text: `New Demo Request\n\nFull Name: ${demo.fullName}\nWork Email: ${demo.workEmail}\nPhone: ${demo.phone}\nOrganization: ${demo.organizationName}\nPreferred Date & Time: ${demo.preferredDateTime || "Not specified"}`,
            });
        } catch (mailError) {
            console.error("Failed to send demo request notification email:", mailError);
        }

        return NextResponse.json({ success: true, data: demo }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// GET — admin only
export async function GET() {
    const auth = await requireAuth();
    if (!auth.authorized) return auth.response;

    const allRoles = auth.user.roles?.length ? auth.user.roles : [auth.user.role];
    if (!allRoles.includes("admin")) {
        return NextResponse.json({ success: false, error: "Admin access required" }, { status: 403 });
    }

    try {
        await dbConnect();
        const requests = await DemoRequest.find().sort({ createdAt: -1 }).lean();
        return NextResponse.json({ success: true, data: requests });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
