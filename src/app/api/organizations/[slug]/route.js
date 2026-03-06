import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import { requireAdmin } from "@/lib/apiAuth";

// GET single organization
export async function GET(request, { params }) {
    try {
        await dbConnect();
        const { slug } = await params;
        const organization = await Organization.findOne({ slug }).lean();

        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { success: true, data: organization },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// UPDATE organization (admin/organizer only)
export async function PUT(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { slug } = await params;
        const body = await request.json();

        const organization = await Organization.findOneAndUpdate(
            { slug },
            body,
            { new: true, runValidators: true }
        );

        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { success: true, data: organization },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE organization (admin only)
export async function DELETE(request, { params }) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const { slug } = await params;
        const organization = await Organization.findOneAndDelete({ slug });

        if (!organization) {
            return NextResponse.json(
                { success: false, error: "Organization not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            { success: true, message: "Organization deleted" },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
