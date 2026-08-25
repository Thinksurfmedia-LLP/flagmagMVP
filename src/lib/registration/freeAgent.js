import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "@/models/User";
import Player from "@/models/Player";
import Organization from "@/models/Organization";
import League from "@/models/League";
import { RegistrationError } from "@/lib/registration/errors";
import { US_STATES } from "@/lib/usGeoData";

/**
 * Public self-serve free-agent registration: always creates a brand-new
 * User + Player. Deliberately does NOT accept an existing userId — that
 * branch exists on the admin-only POST /api/free-agents route, where the
 * caller is already authenticated as admin/organizer. Exposing it here
 * would let anyone attach a free_agent role (and an organization) to any
 * email address just by knowing it, without a password check.
 */
export async function registerFreeAgent({
    name,
    email,
    phone,
    password,
    organizationId,
    requestedLeagueId,
    address,
    state,
    location,
    notes,
}) {
    if (!name || !email || !password) {
        throw new RegistrationError("VALIDATION", "Name, email, and password are required", 400);
    }
    if (password.length < 6) {
        throw new RegistrationError("VALIDATION", "Password must be at least 6 characters", 400);
    }
    if (!organizationId || !mongoose.isValidObjectId(organizationId)) {
        throw new RegistrationError("VALIDATION", "Please select a league to join", 400);
    }
    if (!state?.trim()) {
        throw new RegistrationError("VALIDATION", "Please select your state", 400);
    }

    const organization = await Organization.findById(organizationId).select("_id").lean();
    if (!organization) {
        throw new RegistrationError("ORG_NOT_FOUND", "Selected league could not be found", 400);
    }

    if (requestedLeagueId) {
        if (!mongoose.isValidObjectId(requestedLeagueId)) {
            throw new RegistrationError("VALIDATION", "Invalid division selection", 400);
        }
        const league = await League.findOne({ _id: requestedLeagueId, organization: organizationId }).select("_id").lean();
        if (!league) {
            throw new RegistrationError("VALIDATION", "Selected division does not belong to that league", 400);
        }
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail }).select("_id").lean();
    if (existingUser) {
        throw new RegistrationError(
            "EMAIL_TAKEN",
            "An account with this email already exists. Please log in instead.",
            409
        );
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    let user;
    try {
        user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            phone: phone || "",
            password: hashedPassword,
            role: "free_agent",
            roles: ["free_agent"],
            organization: organizationId,
            roleOrganizations: { free_agent: [organizationId] },
        });
    } catch (err) {
        // The findOne check above isn't atomic with this create — a
        // concurrent duplicate-email submission (accidental double-submit)
        // can still race past it and hit the unique index here. Translate
        // that into the same clean 409 instead of letting a raw Mongo
        // E11000 error (with index/collection names) reach the client.
        if (err.code === 11000) {
            throw new RegistrationError(
                "EMAIL_TAKEN",
                "An account with this email already exists. Please log in instead.",
                409
            );
        }
        throw err;
    }

    // City + full state name as a single display string, matching how
    // Player.location is used elsewhere as free text rather than a
    // structured address. Resolves the abbreviation the same way
    // registerTeam does, so the two flows store this consistently.
    const stateName = US_STATES.find((s) => s.abbr === state.trim().toUpperCase())?.name || state.trim();
    const combinedLocation = [location?.trim(), stateName].filter(Boolean).join(", ");

    let player;
    try {
        player = await Player.create({
            user: user._id,
            name: user.name,
            organization: organizationId,
            status: "free_agent",
            requestedLeague: requestedLeagueId || null,
            location: combinedLocation,
            address: address?.trim() || "",
            about: notes?.trim() || "",
        });
    } catch (err) {
        // No multi-document transactions in this codebase (single-node
        // Mongo in most environments) — a compensating delete keeps a
        // failed second write from leaving an orphaned, half-registered
        // user account behind.
        await User.deleteOne({ _id: user._id }).catch(() => {});
        throw err;
    }

    return { user, player };
}
