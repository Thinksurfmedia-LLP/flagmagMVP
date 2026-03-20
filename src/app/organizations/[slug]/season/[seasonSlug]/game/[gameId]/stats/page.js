import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GameTeamStats from "@/components/GameTeamStats";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Game from "@/models/Game";
import { formatOrganizationLocations } from "@/lib/organizationLocations";

const DUMMY_DATA = {
    org: {
        _id: "dummy",
        name: "xFlag Football",
        slug: "xflag-football",
        bannerImage: "/assets/images/inner-banner2.jpg",
        logo: "/assets/images/teamlogo1.png",
        rating: "4.8",
        memberCount: 120,
        foundedYear: 2010,
        location: "Los Angeles, CA",
    },
    league: { _id: "dummy", name: "Spring 2025 Season" },
    game: {
        _id: "dummy",
        teamA: { name: "Red Hawks", logo: "/assets/images/t-logo.jpg", score: 27 },
        teamB: { name: "Blue Thunder", logo: "/assets/images/t-logo.jpg", score: 21 },
        status: "completed",
    },
};

const DUMMY_PLAYERS = [
    { _id: "d1", name: "Marcus Johnson", photo: "/assets/images/t-logo.jpg", teamLogo: "/assets/images/t-logo.jpg", rate: 118.4, atts: 24, comp: 18, tds: 3, pct: "75.0", xp2: 1, yards: 214, ten: 6, twenty: 3, forty: 1, ints: 0, intOpen: 0, intXp: 0 },
    { _id: "d2", name: "Tyler Brooks", photo: "/assets/images/t-logo.jpg", teamLogo: "/assets/images/t-logo.jpg", rate: 97.2, atts: 10, comp: 7, tds: 1, pct: "70.0", xp2: 0, yards: 88, ten: 2, twenty: 1, forty: 0, ints: 1, intOpen: 0, intXp: 1 },
    { _id: "d3", name: "Devonte Williams", photo: "/assets/images/t-logo.jpg", teamLogo: "/assets/images/t-logo.jpg", rate: 104.6, atts: 8, comp: 6, tds: 2, pct: "75.0", xp2: 0, yards: 102, ten: 3, twenty: 1, forty: 0, ints: 0, intOpen: 0, intXp: 0 },
    { _id: "d4", name: "Jordan Smith", photo: "/assets/images/t-logo.jpg", teamLogo: "/assets/images/t-logo.jpg", rate: 88.1, atts: 15, comp: 10, tds: 1, pct: "66.7", xp2: 1, yards: 135, ten: 4, twenty: 1, forty: 0, ints: 0, intOpen: 1, intXp: 0 },
    { _id: "d5", name: "Chris Navarro", photo: "/assets/images/t-logo.jpg", teamLogo: "/assets/images/t-logo.jpg", rate: 75.3, atts: 6, comp: 4, tds: 0, pct: "66.7", xp2: 0, yards: 45, ten: 1, twenty: 0, forty: 0, ints: 1, intOpen: 0, intXp: 0 },
];

async function getData(slug, seasonSlug, gameId) {
    try {
        await dbConnect();
        const org = await Organization.findOne({ slug }).lean();
        if (!org) return null;
        const league = await League.findOne({ organization: org._id, slug: seasonSlug }).lean();
        if (!league) return null;
        const game = await Game.findById(gameId).lean();
        if (!game) return null;
        return {
            org: JSON.parse(JSON.stringify(org)),
            league: JSON.parse(JSON.stringify(league)),
            game: JSON.parse(JSON.stringify(game)),
            isDummy: false,
        };
    } catch {
        return null;
    }
}

export default async function GameTeamStatsPage({ params }) {
    const { slug, seasonSlug, gameId } = await params;
    const data = (await getData(slug, seasonSlug, gameId)) || { ...DUMMY_DATA, isDummy: true };

    const { org, league, game } = data;
    const isDummy = data.isDummy;
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
                                    <li><img src="/assets/images/icon-star.png" alt="" /> <span>{org.rating}</span> ({org.memberCount} members)</li>
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
                        orgSlug={slug}
                        seasonSlug={seasonSlug}
                        gameId={gameId}
                        dummyPlayers={isDummy ? DUMMY_PLAYERS : undefined}
                    />
                </div>
            </section>

            <Footer />
        </>
    );
}
