import League from "@/models/League";
import Season from "@/models/Season";

// Single source of truth for "is this league active or past" — a league is
// active exactly when it sits in its organization's current default season;
// every other league is past. This is what drives the admin Leagues list
// STATUS column/season filter, the public org page's Active/Past tabs, AND
// signup eligibility (both flagmag's and xFlag's /signup, which filter on
// League.type=active). An organizer can still pin a specific league's
// status manually (League.typeOverridden) — see below — in which case
// nothing here touches it again until they un-pin it.

/**
 * Computes the auto-derived type for a league being created right now, from
 * its season's current isDefault flag. Falls back to "active" if no season
 * is set, matching this codebase's pre-existing default for leagues that
 * predate season tracking.
 */
export async function computeLeagueType(seasonId) {
    if (!seasonId) return "active";
    const season = await Season.findById(seasonId).select("isDefault").lean();
    return season?.isDefault ? "active" : "past";
}

/**
 * Called whenever a Season becomes its organization's new default (season
 * created or updated with isDefault: true). Re-derives `type` for every
 * League in that org that hasn't been manually pinned via typeOverridden —
 * "active" if it's in the new default season, "past" otherwise — so status
 * never silently drifts out of sync with which season is actually current.
 */
export async function syncLeagueTypesToDefaultSeason(organizationId, defaultSeasonId) {
    await League.updateMany(
        { organization: organizationId, season: defaultSeasonId, typeOverridden: { $ne: true } },
        { $set: { type: "active" } }
    );
    await League.updateMany(
        { organization: organizationId, season: { $ne: defaultSeasonId }, typeOverridden: { $ne: true } },
        { $set: { type: "past" } }
    );
}
