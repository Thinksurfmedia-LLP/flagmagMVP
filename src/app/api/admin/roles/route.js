import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Role, { seedDefaultRoles } from "@/models/Role";
import { requireAdmin } from "@/lib/apiAuth";

export async function GET() {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        await seedDefaultRoles();
        const roles = await Role.find({}).sort({ isSystem: -1, name: 1 }).lean();
        return NextResponse.json({ success: true, data: roles });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

export async function POST(request) {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    if (auth.user.role !== "admin") {
        return NextResponse.json(
            { success: false, error: "Only admins can create roles" },
            { status: 403 }
        );
    }

    try {
        await dbConnect();
        const { name, permissions } = await request.json();

        if (!name || !name.trim()) {
            return NextResponse.json(
                { success: false, error: "Role name is required" },
                { status: 400 }
            );
        }

        const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

        const existing = await Role.findOne({ $or: [{ slug }, { name: name.trim() }] });
        if (existing) {
            return NextResponse.json(
                { success: false, error: "A role with this name already exists" },
                { status: 409 }
            );
        }

        const role = await Role.create({
            name: name.trim(),
            slug,
            permissions: permissions || [],
            isSystem: false,
        });

        return NextResponse.json({ success: true, data: role }, { status: 201 });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
