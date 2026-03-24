import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GameTeamStats from "@/components/GameTeamStats";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Game from "@/models/Game";
import Player from "@/models/Player";
import { formatOrganizationLocations } from "@/lib/organizationLocations";

async function getData(slug, seasonSlug, gameId) {
    try {
        await dbConnect();
        const org = await Organization.findOne({ slug }).lean();
        if (!org) return null;
        const league = await League.findOne({ organization: org._id, slug: seasonSlug }).lean();
        if (!league) return null;
        const game = await Game.findById(gameId).lean();
        if (!game) return null;
        const playerCount = await Player.countDocuments({ organization: org._id });
        return {
            org: JSON.parse(JSON.stringify({ ...org, playerCount })),
            league: JSON.parse(JSON.stringify(league)),
            game: JSON.parse(JSON.stringify(game)),
        };
    } catch {
        return null;
    }
}

export default async function GameTeamStatsPage({ params }) {
    const { slug, seasonSlug, gameId } = await params;
    const data = await getData(slug, seasonSlug, gameId);

    if (!data) {
        return (
            <><Header /><section className="innerpage-section type2"><div className="container py-5 text-center"><h1>Game not found</h1></div></section><Footer /></>
        );
    }

    const { org, league, game } = data;
    const locationText = formatOrganizationLocations(org);

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
                    </div>
                </div>
            </section>

            <section className="leagues-section section-padding">
                <div className="container">
                    <div className="heading-area"><h2>{league.name}</h2></div>

                    <GameTeamStats
                        teamA={game.teamA}
                        teamB={game.teamB}
                        gameId={gameId}
                    />
                </div>
            </section>

            <Footer />
        </>
    );
}
