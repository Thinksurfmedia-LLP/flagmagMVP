import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ScheduleWithDateStrip from "@/components/ScheduleWithDateStrip";
import Link from "next/link";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Game from "@/models/Game";
import Player from "@/models/Player";
import { formatOrganizationLocations } from "@/lib/organizationLocations";

function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setUTCDate(d.getUTCDate() - diff);
    return d.toISOString().split("T")[0];
}

async function getData(slug, seasonSlug) {
    await dbConnect();
    const org = await Organization.findOne({ slug }).lean();
    if (!org) return null;
    const league = await League.findOne({ organization: org._id, slug: seasonSlug }).lean();
    if (!league) return null;

    // Lightweight query — only dates to build week navigation metadata
    const [gameDates, playerCount] = await Promise.all([
        Game.find({ league: league._id }).select("date").sort({ date: 1 }).lean(),
        Player.countDocuments({ organization: org._id }),
    ]);

    // Build week metadata (weekNum, weekStart, gameCount)
    const weekMap = new Map();
    for (const { date } of gameDates) {
        const ws = getWeekStart(date);
        weekMap.set(ws, (weekMap.get(ws) || 0) + 1);
    }
    const weekMeta = Array.from(weekMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([weekStart, gameCount], idx) => ({ weekNum: idx + 1, weekStart, gameCount }));

    // Determine the best initial week (current or next upcoming; fall back to last)
    const todayWeekStart = getWeekStart(new Date());
    let initialWeekIdx = weekMeta.findIndex((w) => w.weekStart >= todayWeekStart);
    if (initialWeekIdx === -1) initialWeekIdx = Math.max(0, weekMeta.length - 1);

    // Fetch full game data for only the initial week
    let initialGames = [];
    if (weekMeta.length > 0) {
        const ws = weekMeta[initialWeekIdx].weekStart;
        const weekEnd = new Date(ws);
        weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
        initialGames = await Game.find({
            league: league._id,
            date: { $gte: new Date(ws), $lt: weekEnd },
        })
            .sort({ date: 1, time: 1 })
            .lean();
    }

    return {
        org: JSON.parse(JSON.stringify({ ...org, playerCount })),
        league: JSON.parse(JSON.stringify(league)),
        weekMeta,
        initialWeekIdx,
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

    const { org, league, weekMeta, initialWeekIdx, initialGames } = data;
    const locationText = formatOrganizationLocations(org);

    return (
        <>
            <Header />

            <section className="innerpage-section type2">
                <div className="banner-area"><img src={org.bannerImage || "/assets/images/inner-banner2.jpg"} alt="" loading="lazy" /></div>
                <div className="container"></div>
            </section>

            <section className="organization-details-section">
                <div className="container">
                    <div className="row">
                        <div className="col info-area">
                            <div className="logo-area"><img src={org.logo || "/assets/images/teamlogo1.png"} alt="" loading="lazy" /></div>
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
                            <Link href="#" className="btn btn-primary">Register Now</Link>
                            <Link href="#" className="btn btn-info-primary">Contact Now</Link>
                        </div>
                    </div>
                </div>
            </section>

            <section className="leagues-section section-padding">
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
                        weekMeta={weekMeta}
                        initialWeekIdx={initialWeekIdx}
                        initialGames={initialGames}
                        leagueId={String(league._id)}
                        orgSlug={slug}
                        seasonSlug={seasonSlug}
                    />
                </div>
            </section>

            <Footer />
        </>
    );
}
