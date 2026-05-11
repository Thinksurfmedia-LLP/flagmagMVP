import { NextResponse } from "next/server";
import dbConnect from "@/lib/dbConnect";
import Player from "@/models/Player";
import { requireAdmin, requireAuth, hasRole } from "@/lib/apiAuth";

// GET all players
export async function GET(request) {
    try {
        // Require authentication to view players
        const auth = await requireAuth();
        if (!auth.authorized) return auth.response;

        console.log('\n=== API /api/players called ===');
        console.log('User:', auth.user.email, 'Role:', auth.user.role, 'Roles:', auth.user.roles);
        console.log('User ID from token:', auth.user._id);

        await dbConnect();
        
        // Fetch fresh user data from database to get current organization
        const mongoose = require("mongoose");
        const UserModel = mongoose.models.User || require("@/models/User").default;
        
        console.log('Looking up user by ID:', auth.user._id);
        const freshUser = await UserModel.findById(auth.user._id).lean();
        console.log('Fresh user found:', !!freshUser);
        
        if (!freshUser) {
            // Try looking up by email as fallback
            console.log('User not found by ID, trying email:', auth.user.email);
            const userByEmail = await UserModel.findOne({ email: auth.user.email }).lean();
            console.log('User found by email:', !!userByEmail);
            if (userByEmail) {
                console.log('Fresh user organization:', userByEmail.organization);
                console.log('Fresh user roleOrganizations:', JSON.stringify(userByEmail.roleOrganizations));
            }
        } else {
            console.log('Fresh user organization:', freshUser.organization);
            console.log('Fresh user roleOrganizations:', JSON.stringify(freshUser.roleOrganizations));
        }

        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search");
        const status = searchParams.get("status");

        const filter = {};

        // Filter by status if provided; default shows all
        if (status) {
            filter.status = status;
        }

        if (search) {
            filter.name = { $regex: search, $options: "i" };
        }

        const TeamModel = mongoose.models.Team || require("@/models/Team").default;

        // If user is an organizer (not admin), filter by their organization
        let allowedPlayerIds = null;
        if (!hasRole(auth.user, "admin")) {
            console.log('User is NOT admin, applying organization filter...');
            
            // Use freshUser or userByEmail depending on what succeeded
            const dbUser = freshUser || (await UserModel.findOne({ email: auth.user.email }).lean());
            
            // Determine user's organization from fresh database data
            let userOrgId = dbUser?.organization;
            
            // If organization field is not set, try roleOrganizations
            if (!userOrgId && dbUser?.roleOrganizations) {
                // Check for organizer role organization
                if (dbUser.roleOrganizations.organizer && Array.isArray(dbUser.roleOrganizations.organizer)) {
                    userOrgId = dbUser.roleOrganizations.organizer[0];
                } else if (dbUser.roleOrganizations.organizer) {
                    userOrgId = dbUser.roleOrganizations.organizer;
                }
            }
            
            console.log('Determined userOrgId:', userOrgId);
            
            // If we found an organization, filter players
            if (userOrgId) {
                // Get all teams in this organization
                const orgTeams = await TeamModel.find({ organization: userOrgId }).lean();
                console.log('Teams in organization:', orgTeams.length);
                
                // Extract all player IDs from these teams
                allowedPlayerIds = new Set();
                for (const team of orgTeams) {
                    for (const p of (team.players || [])) {
                        if (p.player) allowedPlayerIds.add(p.player.toString());
                    }
                }
                
                console.log('Player IDs from teams:', Array.from(allowedPlayerIds));
                
                // Also include players that have organization field set
                const orgPlayers = await Player.find({ organization: userOrgId }).select("_id").lean();
                for (const p of orgPlayers) {
                    allowedPlayerIds.add(p._id.toString());
                }
                
                console.log('Total allowed player IDs:', allowedPlayerIds.size);
                
                // Filter to only allowed player IDs
                if (allowedPlayerIds.size > 0) {
                    filter._id = { $in: Array.from(allowedPlayerIds) };
                } else {
                    // No players found for this organization
                    console.log('No players found for organization, returning empty array');
                    return NextResponse.json({ success: true, count: 0, data: [] }, { status: 200 });
                }
            }
        }

        console.log('Final filter:', JSON.stringify(filter));
        
        const players = await Player.find(filter)
            .populate("organization", "name slug")
            .sort({ name: 1 })
            .lean();

        // Extra: map jersey numbers from Team collection
        const playerIds = players.map(p => p._id);
        
        const teams = await TeamModel.find({ "players.player": { $in: playerIds } }).lean();
        const jerseyMap = {};
        for (const team of teams) {
             for (const p of (team.players || [])) {
                 if (p.player) jerseyMap[p.player.toString()] = p.jerseyNumber;
             }
        }
        
        players.forEach(p => {
             p.jerseyNumber = jerseyMap[p._id.toString()] || null;
        });

        console.log('Returning', players.length, 'players');
        players.forEach(p => console.log(`  - ${p.name}`));
        console.log('=== End API call ===\n');

        return NextResponse.json({ success: true, count: players.length, data: players }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// CREATE player (admin/organizer only)
export async function POST(request) {
    try {
        const auth = await requireAdmin();
        if (!auth.authorized) return auth.response;

        await dbConnect();
        const body = await request.json();
        const player = await Player.create(body);
        return NextResponse.json({ success: true, data: player }, { status: 201 });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
