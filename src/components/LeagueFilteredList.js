"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";

// A league can be played across several venues (season.locations), but older
// leagues only ever got the single legacy season.location string. Prefer the
// array; fall back to the legacy field so those older leagues still show
// something instead of blank.
function getLeagueLocations(season) {
    if (Array.isArray(season.locations) && season.locations.length > 0) return season.locations;
    return season.location ? [season.location] : [];
}

// Show up to a few venue names inline, then collapse the rest into a "+N" so
// the card doesn't grow with every venue a league is played at.
const MAX_LOCATIONS_SHOWN = 3;
function formatLocationsDisplay(locations) {
    if (locations.length === 0) return "TBD";
    if (locations.length <= MAX_LOCATIONS_SHOWN) return locations.join(", ");
    const shown = locations.slice(0, MAX_LOCATIONS_SHOWN).join(", ");
    return `${shown} +${locations.length - MAX_LOCATIONS_SHOWN}`;
}

function LeagueCard({ season, orgSlug, showSeasonName }) {
    const leagueImg = season.image || "/assets/images/league-placeholder.svg";
    const locationsDisplay = formatLocationsDisplay(getLeagueLocations(season));
    return (
        <div className="col-lg-6">
            <div className="leagues-card">
                <div className="badge">{season.category}</div>
                <div className="left">
                    <div className="bg"><img src={leagueImg} alt="" /></div>
                    <img src={leagueImg} alt="" />
                </div>
                <div className="right">
                    <h5>{season.name}</h5>
                    <ul>
                        {/* Only shown while the season dropdown is on "All Seasons" —
                            that's the one view where two leagues can share a name
                            (e.g. "Chino" every summer) with nothing else on the card
                            telling them apart. Picking a specific season already
                            disambiguates the whole list, so this would be redundant. */}
                        {showSeasonName && season.seasonName && (
                            <li><img src="/assets/images/icon-calander.png" alt="" /> Season - <span>{season.seasonName}</span></li>
                        )}
                        <li><img src="/assets/images/icon-map.png" alt="" /> Locations - <span title={getLeagueLocations(season).join(", ")}>{locationsDisplay}</span></li>
                        <li><img src="/assets/images/icon-calander.png" alt="" /> Start date - <span>{new Date(season.startDate).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "2-digit" })}</span></li>
                        <li><img src="/assets/images/icon-clock.png" alt="" /> Time - <span>{season.firstGameTime || season.time || "TBD"}</span></li>
                    </ul>
                    <div className="button-area">
                        <Link href={`/organizations/${orgSlug}/season/${season.slug}`} className="btn btn-primary">Enter Season</Link>
                        {/* <Link href="#" className="btn btn-info-primary">Sign-In</Link> */}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LeagueFilteredList({ leagues, orgSlug, defaultSeasonName = "", onCountChange }) {
    const [locationFilter, setLocationFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    // Defaults to the org's default season (set in Admin > Seasons) instead
    // of "All Seasons" — otherwise every reused league name (e.g. "Chino"
    // every summer) shows once per season with nothing but the small
    // "Season -" line to tell them apart. Falls back to "All Seasons" if
    // that season has no leagues in THIS list (e.g. the default season
    // hasn't started yet, or this is the Past Leagues tab) rather than
    // defaulting into an empty result.
    const [seasonFilter, setSeasonFilter] = useState(() =>
        defaultSeasonName && leagues.some((l) => l.seasonName === defaultSeasonName) ? defaultSeasonName : ""
    );

    // Extract unique values for dropdowns
    const uniqueLocations = useMemo(() => {
        const locs = new Set();
        leagues.forEach(l => {
            getLeagueLocations(l).forEach(loc => locs.add(loc));
        });
        return [...locs].sort();
    }, [leagues]);

    const uniqueCategories = useMemo(() => {
        const cats = new Set();
        leagues.forEach(l => {
            if (l.category) cats.add(l.category);
        });
        return [...cats].sort();
    }, [leagues]);

    const uniqueSeasons = useMemo(() => {
        const seasons = new Map();
        leagues.forEach(l => {
            if (l.seasonName) seasons.set(l.seasonName, l.seasonName);
        });
        return [...seasons.values()].sort();
    }, [leagues]);

    const filtered = useMemo(() => {
        return leagues.filter(l => {
            if (locationFilter && !getLeagueLocations(l).includes(locationFilter)) return false;
            if (categoryFilter && l.category?.toLowerCase() !== categoryFilter.toLowerCase()) return false;
            if (seasonFilter && l.seasonName !== seasonFilter) return false;
            return true;
        });
    }, [leagues, locationFilter, categoryFilter, seasonFilter]);

    // Lets the tab label above this list ("Active Leagues (N)") track
    // whatever's actually showing — including the initial default-season
    // filter, and relabeling itself to "Past Leagues" when the visitor picks
    // an earlier season here — instead of always "Active Leagues" + the
    // unfiltered total.
    useEffect(() => {
        onCountChange?.(filtered.length, seasonFilter);
    }, [filtered.length, seasonFilter, onCountChange]);

    return (
        <>
            <div className="leagues-filter-area">
                <select className="form-select" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}>
                    <option value="">All Locations</option>
                    {uniqueLocations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                    ))}
                </select>
                <select className="form-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                    <option value="">All Types</option>
                    {uniqueCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                    ))}
                </select>
                <select className="form-select" value={seasonFilter} onChange={e => setSeasonFilter(e.target.value)}>
                    <option value="">All Seasons</option>
                    {uniqueSeasons.map(s => (
                        <option key={s} value={s}>{s}</option>
                    ))}
                </select>
            </div>

            <div className="row mt-3 g-4">
                {filtered.length > 0 ? filtered.map((season) => (
                    <LeagueCard key={season._id} season={season} orgSlug={orgSlug} showSeasonName={!seasonFilter} />
                )) : (
                    <div className="col-12 text-center py-4"><p>No leagues match the selected filters.</p></div>
                )}
            </div>
        </>
    );
}
