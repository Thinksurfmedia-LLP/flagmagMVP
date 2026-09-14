import mongoose from "mongoose";
import League from "@/models/League";
import Season from "@/models/Season";

// League.slug now only has to be unique within {organization, season} at the
// DB level (see League.js's index), but it also doubles as the public URL
// segment for /organizations/[slug]/season/[seasonSlug] — those read routes
// resolve a league by {organization, slug} alone, with no season filter, so
// two same-named leagues in different seasons would collide on the exact
// same URL and the lookup would return whichever one Mongo happens to match
// first. Keeping the slug itself unique per organization (by disambiguating
// it here, at creation time) avoids that without touching every read route.
//
// The league's display `name` is untouched — both leagues still show as
// plain "Chino" in lists; only the URL-facing slug gets a suffix.
export async function generateUniqueLeagueSlug({ organizationId, seasonId, name, excludeId }) {
    const base = String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const isTaken = async (slug) => {
        const query = { organization: organizationId, slug };
        if (excludeId) query._id = { $ne: excludeId };
        return Boolean(await League.exists(query));
    };

    if (!(await isTaken(base))) return base;

    // Prefer a season-based suffix (readable, stable) over a bare counter.
    if (seasonId && mongoose.isValidObjectId(seasonId)) {
        const season = await Season.findById(seasonId).select("slug").lean();
        if (season?.slug) {
            const withSeason = `${base}-${season.slug}`;
            if (!(await isTaken(withSeason))) return withSeason;
        }
    }

    // Fall back to an incrementing numeric suffix.
    let n = 2;
    while (await isTaken(`${base}-${n}`)) n++;
    return `${base}-${n}`;
}
