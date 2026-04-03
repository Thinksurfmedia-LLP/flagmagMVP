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

        if (freeAgentUsers.length > 0) {
            const userIds = freeAgentUsers.map(u => u._id);
            const userOrgIds = [...new Set(freeAgentUsers.map(u => String(u.organization)))];

            const existingPlayers = await Player.find({ user: { $in: userIds } }).select("user").lean();
            const existingUserIds = new Set(existingPlayers.map(p => String(p.user)));

            const orphans = await Player.find({ user: null, status: "free_agent", organization: { $in: userOrgIds } }).select("_id name organization").lean();
            const orphanMap = new Map();
            for (const o of orphans) {
                const key = `${o.name}|${o.organization}`;
                if (!orphanMap.has(key)) orphanMap.set(key, []);
                orphanMap.get(key).push(o._id);
            }

            const bulkOps = [];

            for (const u of freeAgentUsers) {
                const key = `${u.name}|${u.organization}`;
                const userOrphans = orphanMap.get(key) || [];

                if (existingUserIds.has(String(u._id))) {
                    for (const orphanId of userOrphans) {
                        bulkOps.push({ deleteOne: { filter: { _id: orphanId } } });
                    }
                } else {
                    if (userOrphans.length > 0) {
                        const orphanToClaim = userOrphans[0];
                        bulkOps.push({ updateOne: { filter: { _id: orphanToClaim }, update: { $set: { user: u._id } } } });
                        for (let i = 1; i < userOrphans.length; i++) {
                            bulkOps.push({ deleteOne: { filter: { _id: userOrphans[i] } } });
                        }
                    } else {
                        bulkOps.push({
                            insertOne: { document: { user: u._id, name: u.name, organization: u.organization, status: "free_agent" } }
                        });
                    }
                }
            }

            if (bulkOps.length > 0) {
                await Player.bulkWrite(bulkOps, { ordered: false }).catch(() => {});
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
        const missingUserRefs = freeAgents.filter(fa => !fa.user);
        const unpopulatedUserRefs = freeAgents.filter(fa => fa.user && !fa.user.email);
        
        const bulkUserOps = [];
        
        if (missingUserRefs.length > 0) {
            const names = missingUserRefs.map(fa => fa.name);
            const orgs = missingUserRefs.map(fa => fa.organization?._id || fa.organization);
            const matchedUsers = await User.find({ name: { $in: names }, organization: { $in: orgs }, roles: "free_agent" }).select("name email phone organization").lean();
            
            for (const fa of missingUserRefs) {
                const faOrg = String(fa.organization?._id || fa.organization);
                const userDoc = matchedUsers.find(u => u.name === fa.name && String(u.organization) === faOrg);
                if (userDoc) {
                    fa.user = userDoc;
                    bulkUserOps.push({ updateOne: { filter: { _id: fa._id }, update: { $set: { user: userDoc._id } } } });
                }
            }
        }
        
        if (unpopulatedUserRefs.length > 0) {
            const userIds = unpopulatedUserRefs.map(fa => fa.user._id || fa.user);
            const matchedUsers = await User.find({ _id: { $in: userIds } }).select("name email phone").lean();
            const userMap = new Map(matchedUsers.map(u => [String(u._id), u]));
            
            for (const fa of unpopulatedUserRefs) {
                const uid = String(fa.user._id || fa.user);
                if (userMap.has(uid)) {
                    fa.user = userMap.get(uid);
                }
            }
        }

        if (bulkUserOps.length > 0) {
            await Player.bulkWrite(bulkUserOps, { ordered: false }).catch((e) => {
                const writeErrors = e.writeErrors || [];
                for (const err of writeErrors) {
                    if (err.code === 11000) {
                        Player.deleteOne({ _id: bulkUserOps[err.index].updateOne.filter._id }).catch(() => {});
                    }
                }
            });
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
