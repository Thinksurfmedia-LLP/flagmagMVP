import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import Season from "@/models/Season";
import Game from "@/models/Game";

async function getData(slug, seasonSlug) {
    await dbConnect();
    const org = await Organization.findOne({ slug }).lean();
    if (!org) return null;
    const season = await Season.findOne({ organization: org._id, slug: seasonSlug }).lean();
    if (!season) return null;
    const games = await Game.find({ season: season._id }).sort({ date: 1, time: 1 }).lean();
    return {
        org: JSON.parse(JSON.stringify(org)),
        season: JSON.parse(JSON.stringify(season)),
        games: JSON.parse(JSON.stringify(games)),
    };
}

function MatchCard({ game }) {
    return (
        <div className="col-xl-6">
            <div className="organization-team-area">
                <div className="top">
                    <ul>
                        <li><img src="/assets/images/icon-clock.png" alt="" /> Time - <span>{game.time}</span></li>
                        <li><img src="/assets/images/icon-calander.png" alt="" /> Date - <span>{new Date(game.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" })}</span></li>
                    </ul>
                </div>
                <div className="middle">
                    <div className="a">
                        <img src={game.teamA.logo || "/assets/images/team1.png"} alt="" />
                        <h6>{game.teamA.name}</h6>
                    </div>
                    <div className="b">
                        {game.status === "completed" ? (
                            <span>{game.teamA.score} - {game.teamB.score}</span>
                        ) : (
                            <span>YET TO BE PLAYED</span>
                        )}
                    </div>
                    <div className="c">
                        <img src={game.teamB.logo || "/assets/images/team2.png"} alt="" />
                        <h6>{game.teamB.name}</h6>
                    </div>
                </div>
                <div className="bottom">
                    <ul>
                        <li><img src="/assets/images/icon-map.png" alt="" /> Locations - <span>{game.location}</span></li>
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default async function SeasonSchedulePage({ params }) {
    const { slug, seasonSlug } = await params;
    const data = await getData(slug, seasonSlug);

    if (!data) {
        return (
            <><Header /><section className="innerpage-section type2"><div className="container py-5 text-center"><h1>Season not found</h1></div></section><Footer /></>
        );
    }

    const { org, season, games } = data;

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
                                    <li><img src="/assets/images/icon-star.png" alt="" /> <span>{org.rating}</span> ({org.memberCount} members)</li>
                                    <li><img src="/assets/images/icon-calander.png" alt="" /> <span>Founded {org.foundedYear}</span></li>
                                    <li><img src="/assets/images/icon-map.png" alt="" /> <span>{org.location}</span></li>
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
                    <div className="heading-area"><h2>{season.name}</h2></div>

                    <div className="organization-nav-area">
                        <ul>
                            <li className="active"><Link href={`/organizations/${slug}/season/${seasonSlug}`}>Schedules</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/game-stats`}>Game Stats</Link></li>
                            <li><Link href="#">Player Stat</Link></li>
                            <li><Link href="#">Location</Link></li>
                            <li><Link href="#">Media</Link></li>
                        </ul>
                    </div>

                    <div className="organization-teams-wrap row g-4 g-xxl-5">
                        {games.length > 0 ? games.map((game) => (
                            <MatchCard key={game._id} game={game} />
                        )) : (
                            <div className="col-12 text-center py-4"><p>No games scheduled yet.</p></div>
                        )}
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}
