import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Player from "@/models/Player";
import Team from "@/models/Team";
import { formatOrganizationLocations } from "@/lib/organizationLocations";
import PlayerStatsFilter from "@/components/PlayerStatsFilter";

async function getData(slug, seasonSlug) {
    await dbConnect();
    const org = await Organization.findOne({ slug }).lean();
    if (!org) return null;
    const league = await League.findOne({ organization: org._id, slug: seasonSlug }).lean();
    if (!league) return null;
    const [players, teams] = await Promise.all([
        Player.find({ organization: org._id }).lean(),
        Team.find({ organization: org._id, league: league._id }).lean(),
    ]);

    return {
        org: JSON.parse(JSON.stringify({ ...org, playerCount: players.length })),
        league: JSON.parse(JSON.stringify(league)),
        teams: JSON.parse(JSON.stringify(teams)),
    };
}

export default async function PlayerStatsPage({ params }) {
    const { slug, seasonSlug } = await params;
    const data = await getData(slug, seasonSlug);

    if (!data) {
        return (
            <><Header /><section className="innerpage-section type2"><div className="container py-5 text-center"><h1>Season not found</h1></div></section><Footer /></>
        );
    }

    const { org, league, teams } = data;
    const locationText = formatOrganizationLocations(org);

    // Collect teams from Team collection
    const allTeams = teams.map((t) => ({ name: t.name, logo: t.logo || "" }));

    return (
        <>
            <Header />

            <section className="innerpage-section type2">
                <div className="banner-area"><img src={org.bannerImage || "/assets/images/inner-banner2.jpg"} alt="" /></div>
                <div className="container"></div>
            </section>

            <section className="organization-details-section">
                <div className="container">
                    <div className="row">
                        <div className="col info-area">
                            <div className="logo-area"><img src={org.logo || "/assets/images/teamlogo1.png"} alt="" /></div>
                            <div className="right-part">
                                <h1>{org.name}</h1>
                                <ul>
                                    <li><img src="/assets/images/icon-star.png" alt="" /> <span>{org.rating}</span> ({org.playerCount || 0} members)</li>
                                    <li><img src="/assets/images/icon-calander.png" alt="" /> <span>Founded {org.foundedYear}</span></li>
                                    <li><img src="/assets/images/icon-map.png" alt="" /> <span>{locationText}</span></li>
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
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}`}>Schedules</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/game-stats`}>Standings</Link></li>
                            <li className="active"><Link href={`/organizations/${slug}/season/${seasonSlug}/player-stats`}>Player Stats</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/location`}>Location</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/media`}>Media</Link></li>
                        </ul>
                    </div>

                    <PlayerStatsFilter orgSlug={slug} seasonSlug={seasonSlug} allTeams={allTeams} />

                </div>
            </section>

            <Footer />
        </>
    );
}
