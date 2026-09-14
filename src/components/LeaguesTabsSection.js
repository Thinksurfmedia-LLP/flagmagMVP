"use client";

import { useCallback, useState } from "react";
import LeagueFilteredList from "./LeagueFilteredList";

// Mirrors LeagueFilteredList's own "default to the org's default season"
// rule so the tab label's initial count/season matches what the list
// actually renders on first paint — computing it here too (rather than
// just seeding with activeSeasons.length) avoids a flash right after
// hydration.
function initialSeasonState(leagues, defaultSeasonName) {
    const seasonFilter = defaultSeasonName && leagues.some((l) => l.seasonName === defaultSeasonName)
        ? defaultSeasonName
        : "";
    const count = seasonFilter ? leagues.filter((l) => l.seasonName === seasonFilter).length : leagues.length;
    return { count, seasonFilter };
}

/**
 * Owns the "Active Leagues (N)" / "Past Leagues (N)" tab counts so they
 * track whichever leagues are actually visible in each list right now —
 * including the default-season filter LeagueFilteredList applies on load —
 * instead of always showing the unfiltered total.
 *
 * The Active tab's own label also tracks its season dropdown: the org's
 * default season (or first load) keeps it "Active Leagues", "All Seasons"
 * relabels it "All Leagues", and picking any other specific season
 * relabels it "Past Leagues" — these stay `type: "active"` League
 * documents throughout (the real Past Leagues tab below is a separate
 * `type: "past"` list); a visitor picking an earlier season out of "Active
 * Leagues" is looking at a season that's over, and the label should say so.
 */
export default function LeaguesTabsSection({ activeSeasons, pastSeasons, orgSlug, defaultSeasonName }) {
    const [activeState, setActiveState] = useState(() => initialSeasonState(activeSeasons, defaultSeasonName));
    const [pastCount, setPastCount] = useState(pastSeasons.length);

    // Stable reference (setActiveState is guaranteed stable across renders)
    // — LeagueFilteredList's effect lists this callback as a dependency, so
    // a new function literal here every render would re-fire that effect
    // every render, which calls this, which re-renders this component,
    // which creates a new function literal... an infinite update loop.
    const handleActiveFilterChange = useCallback(
        (count, seasonFilter) => setActiveState({ count, seasonFilter }),
        []
    );

    const activeTabLabel = !activeState.seasonFilter
        ? "All Leagues"
        : activeState.seasonFilter === defaultSeasonName
            ? "Active Leagues"
            : "Past Leagues";

    return (
        <>
            <ul className="nav nav-pills leagues-nav" id="pills-tab" role="tablist">
                <li className="nav-item" role="presentation">
                    <button className="nav-link active" id="leagues-one-tab" data-bs-toggle="pill" data-bs-target="#leagues-one" type="button" role="tab" aria-controls="leagues-one" aria-selected="true">{activeTabLabel} ({activeState.count})</button>
                </li>
                {pastSeasons.length > 0 && (
                    <li className="nav-item" role="presentation">
                        <button className="nav-link" id="leagues-two-tab" data-bs-toggle="pill" data-bs-target="#leagues-two" type="button" role="tab" aria-controls="leagues-two" aria-selected="false">Past Leagues ({pastCount})</button>
                    </li>
                )}
            </ul>

            <div className="tab-content" id="pills-tabContent">
                <div className="tab-pane fade show active" id="leagues-one" role="tabpanel" aria-labelledby="leagues-one-tab" tabIndex="0">
                    <LeagueFilteredList leagues={activeSeasons} orgSlug={orgSlug} defaultSeasonName={defaultSeasonName} onCountChange={handleActiveFilterChange} />
                </div>
                <div className="tab-pane fade" id="leagues-two" role="tabpanel" aria-labelledby="leagues-two-tab" tabIndex="0">
                    <LeagueFilteredList leagues={pastSeasons} orgSlug={orgSlug} onCountChange={setPastCount} />
                </div>
            </div>
        </>
    );
}
