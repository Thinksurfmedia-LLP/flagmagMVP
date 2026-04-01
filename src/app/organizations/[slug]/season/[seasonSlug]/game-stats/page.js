import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import League from "@/models/League";
import Player from "@/models/Player";
import Team from "@/models/Team";
import Game from "@/models/Game";
import { formatOrganizationLocations } from "@/lib/organizationLocations";

async function getData(slug, seasonSlug) {
    await dbConnect();
    const org = await Organization.findOne({ slug }).lean();
    if (!org) return null;
    const league = await League.findOne({ organization: org._id, slug: seasonSlug }).lean();
    if (!league) return null;
    const playerCount = await Player.countDocuments({ organization: org._id });

    // Fetch all teams for this org (for logo + division)
    const teams = await Team.find({ organization: org._id }).select("name logo division").lean();

    // Fetch all completed games for this league
    const games = await Game.find({ league: league._id, status: "completed" }).lean();

    // Build a lookup: normalized team name -> { name, logo, division }
    const teamMeta = {};
    for (const t of teams) {
        teamMeta[t.name.trim().toLowerCase()] = {
            name: t.name.trim(),
            logo: t.logo || "",
            division: (t.division || "").trim(),
        };
    }

    // Seed stats from ALL teams so they appear even with no completed games
    const stats = {};
    for (const t of teams) {
        const key = t.name.trim().toLowerCase();
        stats[key] = {
            name: t.name.trim(),
            logo: t.logo || "",
            division: (t.division || "").trim(),
            wins: 0, losses: 0, pf: 0, pa: 0,
        };
    }

    const getOrCreate = (rawName) => {
        const key = rawName.trim().toLowerCase();
        if (!stats[key]) {
            const meta = teamMeta[key] || { name: rawName.trim(), logo: "", division: "" };
            stats[key] = { name: meta.name, logo: meta.logo, division: meta.division, wins: 0, losses: 0, pf: 0, pa: 0 };
        }
        return stats[key];
    };

    for (const g of games) {
        const aScore = Number(g.teamA.score ?? 0);
        const bScore = Number(g.teamB.score ?? 0);
        const a = getOrCreate(g.teamA.name);
        const b = getOrCreate(g.teamB.name);
        a.pf += aScore; a.pa += bScore;
        b.pf += bScore; b.pa += aScore;
        if (aScore > bScore) { a.wins++; b.losses++; }
        else if (bScore > aScore) { b.wins++; a.losses++; }
        else { a.wins += 0; b.wins += 0; } // tie — no change (can adjust if needed)
    }

    // Sort: by win %, then pf
    const rows = Object.values(stats).map(r => ({
        ...r,
        pct: (r.wins + r.losses) > 0 ? (r.wins / (r.wins + r.losses)) * 100 : 0,
        diff: r.pf - r.pa,
    })).sort((a, b) => b.pct - a.pct || b.pf - a.pf);

    // Group by division
    const divisionNames = [...new Set(rows.map(r => r.division).filter(Boolean))];

    let divisionGroups;
    if (divisionNames.length <= 1) {
        // Single table — use division name as title if there is one
        divisionGroups = [{ name: divisionNames[0] || "", rows }];
    } else {
        // One table per division; teams with no division go to "Other"
        const grouped = {};
        for (const r of rows) {
            const key = r.division || "Other";
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(r);
        }
        divisionGroups = Object.entries(grouped).map(([name, rows]) => ({ name, rows }));
        // Sort groups: named divisions first, "Other" last
        divisionGroups.sort((a, b) => {
            if (a.name === "Other") return 1;
            if (b.name === "Other") return -1;
            return a.name.localeCompare(b.name);
        });
    }

    return {
        org: JSON.parse(JSON.stringify({ ...org, playerCount })),
        league: JSON.parse(JSON.stringify(league)),
        divisionGroups,
    };
}

function DivisionTable({ name, rows, isSingle }) {
    return (
        <div className={isSingle ? "col-xl-8 mb-4" : "col-xl-6 mb-4"}>
            <div className="table-wrap">
                <table className="table">
                    <thead>
                        {name && <tr className="hd"><th colSpan="6">{name}</th></tr>}
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
                        {rows.map((team, i) => {
                            const noGames = team.wins === 0 && team.losses === 0;
                            return (
                                <tr key={i}>
                                    <td><img src={team.logo || "/assets/images/t-logo.jpg"} alt="" /> {team.name}</td>
                                    <td>{team.wins}-{team.losses}</td>
                                    <td>{noGames ? "-" : team.pct.toFixed(2)}</td>
                                    <td>{noGames ? "-" : team.pf}</td>
                                    <td>{noGames ? "-" : team.pa}</td>
                                    <td>{noGames ? "-" : (team.diff > 0 ? `+${team.diff}` : team.diff)}</td>
                                </tr>
                            );
                        })}
                        {rows.length === 0 && (
                            <tr><td colSpan="6" style={{ textAlign: "center", color: "#999", padding: "16px" }}>No teams found.</td></tr>
                        )}
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

    const { org, league, divisionGroups } = data;
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
                            <li className="active"><Link href={`/organizations/${slug}/season/${seasonSlug}/game-stats`}>Standings</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/player-stats`}>Player Stats</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/location`}>Location</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/media`}>Media</Link></li>
                        </ul>
                    </div>

                    <div className={`organization-stats-table-wrap row${divisionGroups.length === 1 ? " justify-content-center" : ""}`}>
                            {divisionGroups.map((group, i) => (
                                <DivisionTable key={i} name={group.name} rows={group.rows} isSingle={divisionGroups.length === 1} />
                            ))}
                        </div>

                    {league.gameRecords && league.gameRecords.length > 0 && (
                        <>
                            <hr />
                            <div className="game-record-area">
                                <div className="heading-area"><h2>Game Records</h2></div>
                                <div className="row">
                                    {league.gameRecords.map((record, i) => (
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
