"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

function LeagueCard({ season, orgSlug }) {
    const leagueImg = season.image || "/assets/images/teamlogo2.png";
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
                        <li><img src="/assets/images/icon-map.png" alt="" /> Locations - <span>{season.location}</span></li>
                        <li><img src="/assets/images/icon-calander.png" alt="" /> Start date - <span>{new Date(season.startDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" })}</span></li>
                        <li><img src="/assets/images/icon-clock.png" alt="" /> Time - <span>{season.firstGameTime || season.time || "TBD"}</span></li>
                    </ul>
                    <div className="button-area">
                        <Link href={`/organizations/${orgSlug}/season/${season.slug}`} className="btn btn-primary">Enter Season</Link>
                        <Link href="#" className="btn btn-info-primary">Sign-In</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function LeagueFilteredList({ leagues, orgSlug }) {
    const [locationFilter, setLocationFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [seasonFilter, setSeasonFilter] = useState("");

    // Extract unique values for dropdowns
    const uniqueLocations = useMemo(() => {
        const locs = new Set();
        leagues.forEach(l => {
            if (l.location) locs.add(l.location);
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
            if (locationFilter && l.location !== locationFilter) return false;
            if (categoryFilter && l.category?.toLowerCase() !== categoryFilter.toLowerCase()) return false;
            if (seasonFilter && l.seasonName !== seasonFilter) return false;
            return true;
        });
    }, [leagues, locationFilter, categoryFilter, seasonFilter]);

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
                    <LeagueCard key={season._id} season={season} orgSlug={orgSlug} />
                )) : (
                    <div className="col-12 text-center py-4"><p>No leagues match the selected filters.</p></div>
                )}
            </div>
        </>
    );
}
