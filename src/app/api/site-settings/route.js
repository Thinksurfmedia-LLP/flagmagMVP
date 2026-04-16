import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import SiteSettings from "@/models/SiteSettings";
import { requireAuth } from "@/lib/apiAuth";

// GET is public — footer and header read from this
export async function GET() {
    try {
        await dbConnect();
        let settings = await SiteSettings.findOne().lean();
        if (!settings) {
            settings = {
                phone: "",
                email: "",
                address: "",
                facebook: "",
                twitter: "",
                instagram: "",
                youtube: "",
            };
        }
        return NextResponse.json({ success: true, data: settings });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PUT is admin-only
export async function PUT(request) {
    const auth = await requireAuth();
    if (!auth.authorized) return auth.response;

    const allRoles = auth.user.roles?.length ? auth.user.roles : [auth.user.role];
    if (!allRoles.includes("admin")) {
        return NextResponse.json(
            { success: false, error: "Admin access required" },
            { status: 403 }
        );
    }

    try {
        await dbConnect();
        const body = await request.json();
        const { phone, email, address, facebook, twitter, instagram, youtube } = body;

        let settings = await SiteSettings.findOne();
        if (!settings) {
            settings = new SiteSettings({});
        }

        if (phone !== undefined) settings.phone = phone.trim();
        if (email !== undefined) settings.email = email.trim();
        if (address !== undefined) settings.address = address.trim();
        if (facebook !== undefined) settings.facebook = facebook.trim();
        if (twitter !== undefined) settings.twitter = twitter.trim();
        if (instagram !== undefined) settings.instagram = instagram.trim();
        if (youtube !== undefined) settings.youtube = youtube.trim();

        await settings.save();
        return NextResponse.json({ success: true, data: settings });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
