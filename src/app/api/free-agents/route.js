import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import User from "@/models/User";
import { requireAnyPermission, hasRole } from "@/lib/apiAuth";

async function getOrgIdForOrganizer(authUser) {
    if (authUser.organization?.id) return authUser.organization.id;
    const userDoc =
        (await User.findById(authUser.id).select("organization roleOrganizations").lean()) ||
        (await User.findOne({ email: authUser.email }).select("organization roleOrganizations").lean());
        
    if (userDoc?.roleOrganizations?.organizer) {
        const orgs = userDoc.roleOrganizations.organizer;
        if (Array.isArray(orgs) && orgs.length > 0) return String(orgs[0]);
        if (typeof orgs === "string") return String(orgs);
    }
    
    return userDoc?.organization ? String(userDoc.organization) : null;
}

// GET free agents
export async function GET(request) {
    const auth = await requireAnyPermission([
        "manage_players",
        "player_view",
        "player_create",
        "player_update",
    ]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search");

        // Sync: ensure every user with free_agent role has a Player document
        const freeAgentUsers = await User.find({ roles: "free_agent", organization: { $ne: null } })
            .select("_id name email phone organization")
            .lean();
        for (const u of freeAgentUsers) {
            const exists = await Player.findOne({ user: u._id, organization: u.organization });
            if (exists) {
                // Remove orphan duplicates (same name/org but no user ref)
                await Player.deleteMany({
                    user: null,
                    name: u.name,
                    organization: u.organization,
                    status: "free_agent",
                    _id: { $ne: exists._id },
                });
            } else {
                try {
                    // Check for an orphan Player (no user ref) with the same name/org
                    const orphan = await Player.findOne({
                        user: null,
                        name: u.name,
                        organization: u.organization,
                        status: "free_agent",
                    });
                    if (orphan) {
                        await Player.updateOne({ _id: orphan._id }, { $set: { user: u._id } });
                    } else {
                        await Player.create({
                            user: u._id,
                            name: u.name,
                            organization: u.organization,
                            status: "free_agent",
                        });
                    }
                } catch (syncErr) {
                    if (syncErr.code !== 11000) throw syncErr;
                }
            }
        }

        const filter = { status: "free_agent" };

        if (hasRole(auth.user, "organizer")) {
            const orgId = await getOrgIdForOrganizer(auth.user);
            if (!orgId) {
                return NextResponse.json({ success: false, error: "Organizer is not assigned to an organization" }, { status: 400 });
            }
            filter.organization = orgId;
        }

        if (search) {
            filter.name = { $regex: search, $options: "i" };
        }

        const freeAgents = await Player.find(filter)
            .populate("user", "name email phone")
            .populate("organization", "name slug")
            .sort({ createdAt: -1 })
            .lean();

        // Ensure email/phone are available even if populate didn't resolve
        for (const fa of freeAgents) {
            if (!fa.user) {
                // No user ref — try to find User by name and organization
                const userDoc = await User.findOne({
                    name: fa.name,
                    organization: fa.organization?._id || fa.organization,
                    roles: "free_agent",
                }).select("name email phone").lean();
                if (userDoc) {
                    fa.user = userDoc;
                    try {
                        await Player.updateOne({ _id: fa._id }, { $set: { user: userDoc._id } });
                    } catch (e) {
                        // Duplicate key — a linked Player already exists, remove this orphan
                        if (e.code === 11000) {
                            await Player.deleteOne({ _id: fa._id });
                        }
                    }
                }
            } else if (!fa.user.email) {
                // user field is an ObjectId (populate failed) — fetch manually
                const userDoc = await User.findById(fa.user._id || fa.user)
                    .select("name email phone")
                    .lean();
                if (userDoc) {
                    fa.user = userDoc;
                }
            }
        }

        return NextResponse.json({ success: true, data: freeAgents });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// CREATE free agent (promote existing user or create new user)
export async function POST(request) {
    const auth = await requireAnyPermission([
        "manage_players",
        "player_create",
    ]);
    if (!auth.authorized) return auth.response;

    try {
        await dbConnect();
        const body = await request.json();

        // Determine organization
        let organizationId;
        if (hasRole(auth.user, "organizer")) {
            organizationId = await getOrgIdForOrganizer(auth.user);
            if (!organizationId) {
                return NextResponse.json({ success: false, error: "Organizer is not assigned to an organization" }, { status: 400 });
            }
        } else {
            organizationId = body.organization;
            if (!organizationId) {
                return NextResponse.json({ success: false, error: "Organization is required" }, { status: 400 });
            }
        }

        let userId;
        let userName;

        if (body.userId) {
            // Promote existing user
            const user = await User.findById(body.userId).select("name role roles").lean();
            if (!user) {
                return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
            }

            // Check if user is already a free agent/player for this org
            const existing = await Player.findOne({ user: body.userId, organization: organizationId });
            if (existing) {
                return NextResponse.json(
                    { success: false, error: "This user is already registered for this organization" },
                    { status: 409 }
                );
            }

            userId = user._id;
            userName = user.name;

            // Update user role to free_agent if currently viewer
            if (user.role === "viewer") {
                await User.updateOne(
                    { _id: userId },
                    { $set: { role: "free_agent" }, $addToSet: { roles: "free_agent" } }
                );
                await User.updateOne({ _id: userId }, { $pull: { roles: "viewer" } });
            }
        } else {
            // Create new user
            if (!body.name || !body.email || !body.password) {
                return NextResponse.json({ success: false, error: "Name, email, and password are required" }, { status: 400 });
            }
            if (body.password.length < 6) {
                return NextResponse.json({ success: false, error: "Password must be at least 6 characters" }, { status: 400 });
            }

            const existingUser = await User.findOne({ email: body.email.toLowerCase().trim() });
            if (existingUser) {
                // Check if this existing user is already registered for this org
                const existingPlayer = await Player.findOne({ user: existingUser._id, organization: organizationId });
                if (existingPlayer) {
                    return NextResponse.json(
                        { success: false, error: "A user with this email is already registered for this organization" },
                        { status: 409 }
                    );
                }

                userId = existingUser._id;
                userName = existingUser.name;

                if (existingUser.role === "viewer") {
                    await User.updateOne(
                        { _id: userId },
                        {
                            $set: {
                                role: "free_agent",
                                organization: organizationId,
                                [`roleOrganizations.free_agent`]: [organizationId],
                            },
                            $addToSet: { roles: "free_agent" },
                        }
                    );
                    await User.updateOne({ _id: userId }, { $pull: { roles: "viewer" } });
                } else {
                    // If already has a role, just add free_agent and set org
                    await User.updateOne(
                        { _id: userId },
                        {
                            $set: {
                                organization: organizationId,
                                [`roleOrganizations.free_agent`]: [organizationId],
                            },
                            $addToSet: { roles: "free_agent" },
                        }
                    );
                }
            } else {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(body.password, salt);

                const newUser = await User.create({
                    name: body.name.trim(),
                    email: body.email.toLowerCase().trim(),
                    phone: body.phone || "",
                    password: hashedPassword,
                    role: "free_agent",
                    roles: ["free_agent"],
                    organization: organizationId,
                    roleOrganizations: {
                        free_agent: [organizationId],
                    },
                });

                userId = newUser._id;
                userName = newUser.name;
            }
        }

        const player = await Player.create({
            user: userId,
            name: userName,
            organization: organizationId,
            status: "free_agent",
        });

        const populated = await Player.findById(player._id)
            .populate("user", "name email phone")
            .populate("organization", "name slug")
            .lean();

        return NextResponse.json({ success: true, data: populated }, { status: 201 });
    } catch (error) {
        if (error.code === 11000) {
            return NextResponse.json(
                { success: false, error: "This user is already registered for this organization" },
                { status: 409 }
            );
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
