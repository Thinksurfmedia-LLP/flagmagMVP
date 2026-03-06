import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import User from "@/models/User";
import { signToken, setAuthCookie } from "@/lib/auth";

export async function POST(request) {
    try {
        await dbConnect();
        const { name, email, phone, password, confirmPassword } =
            await request.json();

        // Validation
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

        if (confirmPassword && password !== confirmPassword) {
            return NextResponse.json(
                { success: false, error: "Passwords do not match" },
                { status: 400 }
            );
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return NextResponse.json(
                { success: false, error: "User with this email already exists" },
                { status: 409 }
            );
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = await User.create({
            name,
            email,
            phone: phone || "",
            password: hashedPassword,
            role: "player",
        });

        // Sign JWT and set cookie
        const token = await signToken({
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
        });
        await setAuthCookie(token);

        return NextResponse.json(
            {
                success: true,
                data: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
