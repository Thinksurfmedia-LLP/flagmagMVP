import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import Organization from "@/models/Organization";
import Role from "@/models/Role";
import { requireAdmin } from "@/lib/apiAuth";

export async function GET() {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const users = await User.find({}, "-password").populate("organization", "name slug").sort({ createdAt: -1 }).lean();
        return NextResponse.json({ success: true, data: users });
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

    try {
        await dbConnect();
        const { name, email, phone, password, role, organization } = await request.json();

        if (!name || !email || !password) {
            return NextResponse.json(
                { success: false, error: "Name, email, and password are required" },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { success: false, error: "Password must be at least 6 characters" },
                { status: 400 }
            );
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { success: false, error: "User with this email already exists" },
                { status: 409 }
            );
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = await User.create({
            name,
            email,
            phone: phone || "",
            password: hashedPassword,
            role: role || "player",
            ...(organization ? { organization } : {}),
        });

        const userData = await User.findById(user._id)
            .select("-password")
            .populate("organization", "name slug")
            .lean();

        return NextResponse.json({ success: true, data: userData }, { status: 201 });
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
