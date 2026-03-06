import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import Season from "@/models/Season";

async function getData(slug, seasonSlug) {
    await dbConnect();
    const org = await Organization.findOne({ slug }).lean();
    if (!org) return null;
    const season = await Season.findOne({ organization: org._id, slug: seasonSlug }).lean();
    if (!season) return null;
    return {
        org: JSON.parse(JSON.stringify(org)),
        season: JSON.parse(JSON.stringify(season)),
    };
}

function DivisionTable({ division }) {
    return (
        <div className="col-xl-6 mb-4">
            <div className="table-wrap">
                <table className="table">
                    <thead>
                        <tr className="hd"><th colSpan="6">{division.name}</th></tr>
                        <tr>
                            <th>TEAM</th>
                            <th>W-L</th>
                            <th>%</th>
                            <th>PF</th>
                            <th>PA</th>
                            <th>+/-</th>
                        </tr>
                    </thead>
                    <tbody>
                        {division.teams.map((team, i) => (
                            <tr key={i}>
                                <td><img src={team.logo || "/assets/images/t-logo.jpg"} alt="" /> {team.name}</td>
                                <td>{team.wins}-{team.losses}</td>
                                <td>{team.pct.toFixed(1)}</td>
                                <td>{team.pf}</td>
                                <td>{team.pa}</td>
                                <td>{team.diff > 0 ? `+${team.diff}` : team.diff}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function GameRecord({ record }) {
    return (
        <div className="col-xl-6 mb-4">
            <div className="game-record">
                <div className="a"><img src={record.playerImage || "/assets/images/record1.jpg"} alt="" /></div>
                <div className="b">
                    <h6>{record.seasonLabel}</h6>
                    <h4>{record.playerName}</h4>
                </div>
                <div className="c">
                    <h5>{record.statValue}</h5>
                    <p>{record.statLabel}</p>
                </div>
            </div>
        </div>
    );
}

export default async function GameStatsPage({ params }) {
    const { slug, seasonSlug } = await params;
    const data = await getData(slug, seasonSlug);

    if (!data) {
        return (
            <><Header /><section className="innerpage-section type2"><div className="container py-5 text-center"><h1>Season not found</h1></div></section><Footer /></>
        );
    }

    const { org, season } = data;

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
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}`}>Schedules</Link></li>
                            <li className="active"><Link href={`/organizations/${slug}/season/${seasonSlug}/game-stats`}>Game Stats</Link></li>
                            <li><Link href="#">Player Stat</Link></li>
                            <li><Link href="#">Location</Link></li>
                            <li><Link href="#">Media</Link></li>
                        </ul>
                    </div>

                    {season.divisions && season.divisions.length > 0 && (
                        <div className="organization-stats-table-wrap row">
                            {season.divisions.map((div, i) => (
                                <DivisionTable key={i} division={div} />
                            ))}
                        </div>
                    )}

                    {season.gameRecords && season.gameRecords.length > 0 && (
                        <>
                            <hr />
                            <div className="game-record-area">
                                <div className="heading-area"><h2>Game Records</h2></div>
                                <div className="row">
                                    {season.gameRecords.map((record, i) => (
                                        <GameRecord key={i} record={record} />
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </section>

            <Footer />
        </>
    );
}
