import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import Season from "@/models/Season";
import Player from "@/models/Player";
import { formatOrganizationLocations } from "@/lib/organizationLocations";

async function getData(slug, seasonSlug) {
    await dbConnect();
    const org = await Organization.findOne({ slug }).lean();
    if (!org) return null;
    const season = await Season.findOne({ organization: org._id, slug: seasonSlug }).lean();
    if (!season) return null;
    const players = await Player.find({}).lean();
    return {
        org: JSON.parse(JSON.stringify(org)),
        season: JSON.parse(JSON.stringify(season)),
        players: JSON.parse(JSON.stringify(players)),
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

    const { org, season, players } = data;
    const locationText = formatOrganizationLocations(org);

    // Build player rows from real DB players, or fall back to sample data
    const playerRows = players.length > 0
        ? players.map((p) => ({
            _id: p._id,
            name: p.name,
            photo: p.photo || "/assets/images/t-logo.jpg",
            teamLogo: p.presentTeam?.logo || "/assets/images/t-logo.jpg",
            rate: "102.08", atts: 12, comp: 102, tds: 10, pct: 60, xp2: "-", yards: 1, ten: 114, twenty: 2, forty: 22, ints: 50, intOpen: 25, intXp: 25,
        }))
        : samplePlayerStats;

    // Collect all team names from divisions for the team tabs
    const allTeams = [];
    if (season.divisions) {
        season.divisions.forEach((div) => {
            if (div.teams) {
                div.teams.forEach((team) => {
                    if (!allTeams.find((t) => t.name === team.name)) {
                        allTeams.push({ name: team.name, logo: team.logo });
                    }
                });
            }
        });
    }

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
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/game-stats`}>Game Stats</Link></li>
                            <li className="active"><Link href={`/organizations/${slug}/season/${seasonSlug}/player-stats`}>Player Stats</Link></li>
                            <li><Link href="#">Location</Link></li>
                            <li><Link href="#">Media</Link></li>
                        </ul>
                    </div>

                    <div className="row justify-content-between align-items-center players-stats-heading-area">
                        <div className="col-auto">
                            <ul className="team-nav">
                                {allTeams.length > 0 ? (
                                    allTeams.map((team, i) => (
                                        <li key={i} className={i === 0 ? "active" : ""}>
                                            <Link href="#">{team.name}</Link>
                                        </li>
                                    ))
                                ) : (
                                    <>
                                        <li className="active"><Link href="#">Team 1</Link></li>
                                        <li><Link href="#">Team 2</Link></li>
                                    </>
                                )}
                            </ul>
                        </div>
                        <div className="col-auto">
                            <div className="dropdown">
                                <a className="btn btn-info-primary dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                                    Passing
                                </a>
                                <ul className="dropdown-menu">
                                    <li><a className="dropdown-item" href="#">Passing</a></li>
                                    <li><a className="dropdown-item" href="#">Rushing</a></li>
                                    <li><a className="dropdown-item" href="#">Receiving</a></li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="organization-stats-table-wrap players-stats">
                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>players</th>
                                        <th>team</th>
                                        <th>Rate</th>
                                        <th>atts</th>
                                        <th>comp</th>
                                        <th>tds</th>
                                        <th>%</th>
                                        <th>xp2</th>
                                        <th>yards</th>
                                        <th>10+</th>
                                        <th>20+</th>
                                        <th>40+</th>
                                        <th>ints</th>
                                        <th>int open</th>
                                        <th>int xp</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {playerRows.map((player, i) => (
                                        <tr key={i}>
                                            <td><img src={player.photo || "/assets/images/t-logo.jpg"} alt="" /> {player._id ? <Link href={`/players/${player._id}`}>{player.name}</Link> : player.name}</td>
                                            <td>{player._id ? <Link href={`/players/${player._id}`}><img src={player.teamLogo || "/assets/images/t-logo.jpg"} alt="" /></Link> : <img src="/assets/images/t-logo.jpg" alt="" />}</td>
                                            <td>{player.rate}</td>
                                            <td>{player.atts}</td>
                                            <td>{player.comp}</td>
                                            <td>{player.tds}</td>
                                            <td>{player.pct}</td>
                                            <td>{player.xp2}</td>
                                            <td>{player.yards}</td>
                                            <td>{player.ten}</td>
                                            <td>{player.twenty}</td>
                                            <td>{player.forty}</td>
                                            <td>{player.ints}</td>
                                            <td>{player.intOpen}</td>
                                            <td>{player.intXp}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </section>

            <Footer />
        </>
    );
}
