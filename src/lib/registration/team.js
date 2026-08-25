import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "@/models/User";
import Team from "@/models/Team";
import Organization from "@/models/Organization";
import League from "@/models/League";
import { RegistrationError } from "@/lib/registration/errors";
import { US_STATES } from "@/lib/usGeoData";

/**
 * Public self-serve team registration: creates a new "team_manager" User
 * plus a real Team document (organization required, leagues left empty).
 * An empty leagues[] keeps the team invisible on every public
 * standings/schedule surface until an organizer explicitly adds it to a
 * league — that's the de facto approval gate, no separate status field
 * needed.
 */
export async function registerTeam({
    name,
    email,
    phone,
    password,
    teamName,
    organizationId,
    requestedLeagueId,
    address,
    state,
    location,
    hearAboutUs,
    notes,
}) {
    if (!name || !email || !password) {
        throw new RegistrationError("VALIDATION", "Name, email, and password are required", 400);
    }
    if (password.length < 6) {
        throw new RegistrationError("VALIDATION", "Password must be at least 6 characters", 400);
    }
    if (!teamName || !teamName.trim()) {
        throw new RegistrationError("VALIDATION", "Team name is required", 400);
    }
    if (!organizationId || !mongoose.isValidObjectId(organizationId)) {
        throw new RegistrationError("VALIDATION", "Please select a league to register your team under", 400);
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
            throw new RegistrationError("VALIDATION", "Invalid league selection", 400);
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

    const existingTeam = await Team.findOne({ organization: organizationId, name: teamName.trim() }).select("_id").lean();
    if (existingTeam) {
        throw new RegistrationError("TEAM_NAME_TAKEN", "A team with this name already exists for that league", 409);
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
            role: "team_manager",
            roles: ["team_manager"],
            organization: organizationId,
            roleOrganizations: { team_manager: [organizationId] },
        });
    } catch (err) {
        // Same race as registerFreeAgent — the findOne check above isn't
        // atomic with this create.
        if (err.code === 11000) {
            throw new RegistrationError(
                "EMAIL_TAKEN",
                "An account with this email already exists. Please log in instead.",
                409
            );
        }
        throw err;
    }

    const stateAbbr = state?.trim().toUpperCase() || "";
    const stateName = US_STATES.find((s) => s.abbr === stateAbbr)?.name || "";

    let team;
    try {
        team = await Team.create({
            name: teamName.trim(),
            organization: organizationId,
            coachName: name.trim(),
            coachPhone: phone || "",
            manager: user._id,
            requestedLeague: requestedLeagueId || null,
            address: address?.trim() || "",
            hearAboutUs: hearAboutUs?.trim() || "",
            description: notes?.trim() || "",
            location: { stateName, stateAbbr, cityName: location?.trim() || "", countyName: "" },
            leagues: [],
            players: [],
        });
    } catch (err) {
        // Same compensating-delete rationale as registerFreeAgent — no
        // transactions available, so roll back the user write by hand.
        await User.deleteOne({ _id: user._id }).catch(() => {});
        if (err.code === 11000) {
            throw new RegistrationError("TEAM_NAME_TAKEN", "A team with this name already exists for that league", 409);
        }
        throw err;
    }

    return { user, team };
}
