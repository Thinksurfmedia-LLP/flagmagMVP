import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import Season from "@/models/Season";
import Player from "@/models/Player";
import Team from "@/models/Team";
import { formatOrganizationLocations } from "@/lib/organizationLocations";
import PlayerStatsFilter from "@/components/PlayerStatsFilter";

async function getData(slug, seasonSlug) {
    await dbConnect();
    const org = await Organization.findOne({ slug }).lean();
    if (!org) return null;
    const season = await Season.findOne({ organization: org._id, slug: seasonSlug }).lean();
    if (!season) return null;
    const [players, teams] = await Promise.all([
        Player.find({ organization: org._id }).lean(),
        Team.find({ organization: org._id }).populate("players", "_id").lean(),
    ]);

    // Build a map of playerId -> team name
    const playerTeamMap = {};
    for (const team of teams) {
        for (const p of team.players || []) {
            playerTeamMap[String(p._id || p)] = team.name;
        }
    }

    return {
        org: JSON.parse(JSON.stringify(org)),
        season: JSON.parse(JSON.stringify(season)),
        players: JSON.parse(JSON.stringify(players)),
        teams: JSON.parse(JSON.stringify(teams)),
        playerTeamMap,
    };
}

// Fallback sample data if no players exist in DB
const samplePlayerStats = [
    { _id: null, name: "Aaron Benton", rate: "102.08", atts: 12, comp: 102, tds: 10, pct: 60, xp2: "-", yards: 1, ten: 114, twenty: 2, forty: 22, ints: 50, intOpen: 25, intXp: 25 },
    { _id: null, name: "Aaron Benton", rate: "102.08", atts: 12, comp: 102, tds: 10, pct: 60, xp2: "-", yards: 1, ten: 114, twenty: 2, forty: 22, ints: 50, intOpen: 25, intXp: 25 },
    { _id: null, name: "Aaron Benton", rate: "102.08", atts: 12, comp: 102, tds: 10, pct: 60, xp2: "-", yards: 1, ten: 114, twenty: 2, forty: 22, ints: 50, intOpen: 25, intXp: 25 },
    { _id: null, name: "Aaron Benton", rate: "102.08", atts: 12, comp: 102, tds: 10, pct: 60, xp2: "-", yards: 1, ten: 114, twenty: 2, forty: 22, ints: 50, intOpen: 25, intXp: 25 },
];

export default async function PlayerStatsPage({ params }) {
    const { slug, seasonSlug } = await params;
    const data = await getData(slug, seasonSlug);

    if (!data) {
        return (
            <><Header /><section className="innerpage-section type2"><div className="container py-5 text-center"><h1>Season not found</h1></div></section><Footer /></>
        );
    }

    const { org, season, players, teams, playerTeamMap } = data;
    const locationText = formatOrganizationLocations(org);

    // Build player rows from real DB players, or fall back to sample data
    const playerRows = players.length > 0
        ? players.map((p) => ({
            _id: p._id,
            name: p.name,
            photo: p.photo || "/assets/images/t-logo.jpg",
            teamLogo: p.presentTeam?.logo || "/assets/images/t-logo.jpg",
            teamName: playerTeamMap[String(p._id)] || p.presentTeam?.name || "",
            rate: "102.08", atts: 12, comp: 102, tds: 10, pct: 60, xp2: "-", yards: 1, ten: 114, twenty: 2, forty: 22, ints: 50, intOpen: 25, intXp: 25,
        }))
        : samplePlayerStats;

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
                                    <li><img src="/assets/images/icon-star.png" alt="" /> <span>{org.rating}</span> ({org.memberCount} members)</li>
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
                    <div className="heading-area"><h2>{season.name}</h2></div>

                    <div className="organization-nav-area">
                        <ul>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}`}>Schedules</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/game-stats`}>Standings</Link></li>
                            <li className="active"><Link href={`/organizations/${slug}/season/${seasonSlug}/player-stats`}>Player Stats</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/location`}>Location</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/media`}>Media</Link></li>
                        </ul>
                    </div>

                    <PlayerStatsFilter playerRows={playerRows} allTeams={allTeams} />

                </div>
            </section>

            <Footer />
        </>
    );
}
