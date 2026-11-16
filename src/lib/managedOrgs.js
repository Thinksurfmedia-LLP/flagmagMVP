import User from "@/models/User";

/**
 * Every organization this user may manage, from the live user record (the
 * JWT's org can be stale until next login, and organizers can have several).
 * @param {{ id?: string, email?: string, organization?: { id?: string } }} authUser
 * @returns {Promise<Set<string>>}
 */
export async function getManagedOrgIds(authUser) {
    const userDoc =
        (await User.findById(authUser.id).select("organization roleOrganizations").lean()) ||
        (await User.findOne({ email: authUser.email }).select("organization roleOrganizations").lean());

    const orgIds = new Set();
    if (userDoc?.organization) orgIds.add(String(userDoc.organization));
    const organizerOrgs = userDoc?.roleOrganizations?.organizer;
    [].concat(organizerOrgs || []).filter(Boolean).forEach((id) => orgIds.add(String(id)));
    if (!userDoc && authUser.organization?.id) orgIds.add(String(authUser.organization.id));
    return orgIds;
}
