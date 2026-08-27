import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScheduleWithDateStrip from "@/components/ScheduleWithDateStrip";
import RegisterNowButton from "@/components/signup/RegisterNowButton";
import Link from "next/link";
import ScrollToContent from "@/components/ScrollToContent";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Game from "@/models/Game";
import Team from "@/models/Team";
import Player from "@/models/Player";
import Schedule from "@/models/Schedule";
import { formatOrganizationLocations } from "@/lib/organizationLocations";

async function getData(slug, seasonSlug) {
    await dbConnect();
    const org = await Organization.findOne({ slug }).lean();
    if (!org) return null;
    const league = await League.findOne({ organization: org._id, slug: seasonSlug }).lean();
    if (!league) return null;

    const [playerCount, leagueSchedule] = await Promise.all([
        Player.countDocuments({ organization: org._id }),
        Schedule.findOne({ leagueId: league._id }).select("weeks.name weeks.games.gameRef").lean(),
    ]);

    // Build sectionMeta from Schedule weeks (source of truth — not from sectionName on Game docs)
    const scheduleWeeks = leagueSchedule?.weeks || [];
    let sectionMeta = scheduleWeeks
        .map((w, idx) => {
            const refs = (w.games || []).map(g => g.gameRef).filter(Boolean).map(String);
            return {
                sectionNum: idx + 1,
                sectionName: w.name || "",
                gameRefs: refs,
                gameCount: refs.length,
            };
        })
        .filter(s => s.gameCount > 0);

    // Fallback: no schedule or no gameRefs — show all games as one section
    if (sectionMeta.length === 0) {
        const allGames = await Game.find({ league: league._id, gameType: { $ne: "practice" } })
            .select("_id").sort({ date: 1 }).lean();
        if (allGames.length > 0) {
            sectionMeta = [{
                sectionNum: 1,
                sectionName: "",
                gameRefs: allGames.map(g => String(g._id)),
                gameCount: allGames.length,
            }];
        }
    }

    // Initial section: first section that has an upcoming game, else last
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let initialSectionIdx = Math.max(0, sectionMeta.length - 1);
    if (sectionMeta.length > 0) {
        const allRefs = sectionMeta.flatMap(s => s.gameRefs);
        const firstUpcoming = allRefs.length > 0
            ? await Game.findOne({ _id: { $in: allRefs }, date: { $gte: today } })
                .select("_id").sort({ date: 1 }).lean()
            : null;
        if (firstUpcoming) {
            const uid = String(firstUpcoming._id);
            const found = sectionMeta.findIndex(s => s.gameRefs.includes(uid));
            if (found !== -1) initialSectionIdx = found;
        }
    }

    // Fetch full game data for the initial section
    let initialGames = [];
    if (sectionMeta.length > 0) {
        const refs = sectionMeta[initialSectionIdx].gameRefs;
        if (refs.length > 0) {
            initialGames = await Game.find({ _id: { $in: refs } }).sort({ date: 1, time: 1 }).lean();
            const teams = await Team.find({ organization: org._id }).select("name logo leagues").lean();
            const teamByName = {};
            teams.forEach((t) => { teamByName[t.name] = t; });

            // Playoff seed numbers live on the team's membership for this
            // specific league — regular (non-playoffs) leagues never show one.
            const isPlayoffs = league.leagueType === "playoffs";
            const seedFor = (team) => {
                if (!isPlayoffs || !team) return null;
                const membership = (team.leagues || []).find((m) => String(m.league) === String(league._id));
                return membership?.seedNumber ?? null;
            };

            initialGames.forEach((game) => {
                const teamA = teamByName[game.teamA?.name];
                const teamB = teamByName[game.teamB?.name];
                if (teamA) game.teamA.logo = teamA.logo || game.teamA.logo;
                if (teamB) game.teamB.logo = teamB.logo || game.teamB.logo;
                if (isPlayoffs) {
                    game.teamA.seedNumber = seedFor(teamA);
                    game.teamB.seedNumber = seedFor(teamB);
                }
            });
        }
    }

    return {
        org: JSON.parse(JSON.stringify({ ...org, playerCount })),
        league: JSON.parse(JSON.stringify(league)),
        sectionMeta: JSON.parse(JSON.stringify(sectionMeta)),
        initialSectionIdx,
        initialGames: JSON.parse(JSON.stringify(initialGames)),
    };
}

export default async function SeasonSchedulePage({ params }) {
    const { slug, seasonSlug } = await params;
    const data = await getData(slug, seasonSlug);

    if (!data) {
        return (
            <><Header /><section className="innerpage-section type2"><div className="container py-5 text-center"><h1>Season not found</h1></div></section><Footer /></>
        );
    }

    const { org, league, sectionMeta, initialSectionIdx, initialGames } = data;
    const locationText = formatOrganizationLocations(org);

    return (
        <>
            <Header />
            <Suspense fallback={null}>
                <ScrollToContent />
            </Suspense>

            <section className="innerpage-section type2">
                <div className="banner-area"><img src={org.bannerImage || "/assets/images/banner-placeholder.svg"} alt="" loading="lazy" /></div>
                <div className="container"></div>
            </section>

            <section className="organization-details-section">
                <div className="container">
                    <div className="row">
                        <div className="col info-area">
                            <div className="logo-area"><img src={org.logo || "/assets/images/org-placeholder.svg"} alt="" loading="lazy" /></div>
                            <div className="right-part">
                                <h1>{org.name}</h1>
                                <ul>
                                    <li><img src="/assets/images/icon-star.png" alt="" loading="lazy" /> <span>{org.rating}</span> ({org.playerCount || 0} members)</li>
                                    <li><img src="/assets/images/icon-calander.png" alt="" loading="lazy" /> <span>Founded {org.foundedYear}</span></li>
                                    <li><img src="/assets/images/icon-map.png" alt="" loading="lazy" /> <span>{locationText}</span></li>
                                </ul>
                            </div>
                        </div>
                        <div className="col-auto button-area">
                            <RegisterNowButton orgSlug={slug} />
                            <Link href="#" className="btn btn-info-primary">Contact Now</Link>
                        </div>
                    </div>
                </div>
            </section>

            <section className="leagues-section section-padding" id="main-content">
                <div className="container">
                    <div className="heading-area"><h2>{league.name}</h2></div>

                    <div className="organization-nav-area">
                        <ul>
                            <li className="active"><Link href={`/organizations/${slug}/season/${seasonSlug}`}>Schedules</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/game-stats`}>Standings</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/player-stats`}>Player Stats</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/location`}>Location</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/media`}>Media</Link></li>
                        </ul>
                    </div>

                    <ScheduleWithDateStrip
                        sectionMeta={sectionMeta}
                        initialSectionIdx={initialSectionIdx}
                        initialGames={initialGames}
                        leagueId={String(league._id)}
                        orgSlug={slug}
                        seasonSlug={seasonSlug}
                        orgTimezone={org.timezone || "America/Los_Angeles"}
                    />
                </div>
            </section>

            <Footer />
        </>
    );
}
