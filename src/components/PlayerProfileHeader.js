import Link from "next/link";

export default function PlayerProfileHeader({ player, derivedLocations = [], presentTeams = [], activeTab = "overview" }) {
    const id = player._id;

    return (
        <>
            <section className="innerpage-section type2">
                <div className="banner-area"><img src={player.bannerImage || "/assets/images/banner-placeholder.svg"} alt="" /></div>
                <div className="container"></div>
            </section>

            <section className="organization-details-section players-details-section">
                <div className="container">
                    <div className="row">
                        <div className="col info-area">
                            <div className="logo-area">
                                <img src={player.photo || "/assets/images/player-placeholder.svg"} alt="" />
                            </div>
                            <div className="right-part">
                                <h1>{player.name}</h1>
                                <ul>
                                    <li><img src="/assets/images/icon-star.png" alt="" /> <span>{player.rating}</span> ({player.memberCount} members)</li>
                                    <li><img src="/assets/images/icon-link.png" alt="" /> <span>Join In {player.joinYear}</span></li>
                                    <li><img src="/assets/images/icon-map.png" alt="" /> <span>{player.location}</span></li>
                                </ul>
                                <div className="content-area mt-4">
                                    <h4>about</h4>
                                    <p>{player.about}</p>
                                    {derivedLocations.length > 0 && (
                                        <>
                                            <h4>Locations</h4>
                                            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
                                                {derivedLocations.slice(0, 3).map((loc, i) => (
                                                    <li key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, paddingRight: 16, marginRight: 8, borderRight: i < Math.min(derivedLocations.length, 3) - 1 || derivedLocations.length > 3 ? "1px solid rgba(255,255,255,0.2)" : "none" }}>
                                                        <span style={{ color: "#FF8C00" }}>●</span>
                                                        {loc.split(" ")[0]}
                                                    </li>
                                                ))}
                                                {derivedLocations.length > 3 && (
                                                    <li style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>
                                                        +{derivedLocations.length - 3}
                                                    </li>
                                                )}
                                            </ul>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="col-xl-4 col-xxl-3 players-info">
                            <div className="item">
                                <h4>Follow On</h4>
                                <ul>
                                    {player.socialLinks?.facebook && <li><a href={player.socialLinks.facebook}><i className="fa-brands fa-facebook-f"></i></a></li>}
                                    {player.socialLinks?.instagram && <li><a href={player.socialLinks.instagram}><i className="fa-brands fa-instagram"></i></a></li>}
                                    {player.socialLinks?.youtube && <li><a href={player.socialLinks.youtube}><i className="fa-brands fa-youtube"></i></a></li>}
                                </ul>
                            </div>
                            {presentTeams && presentTeams.length > 0 ? (
                                <div className="item">
                                    <h4>Present Team</h4>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                                        {presentTeams.map(team => (
                                            <div key={team._id} className="team" style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                                <img src={team.logo || "/assets/images/team-placeholder.svg"} alt="" style={{ width: 40, height: 40, objectFit: "contain" }} />
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <h6 style={{ margin: 0 }}><a href="#" style={{ color: "#fff", textDecoration: "none" }}>{team.name}</a></h6>
                                                    {team.jerseyNumber != null && (
                                                        <span style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontWeight: 600, color: "#FF8C00" }}>
                                                            #{team.jerseyNumber}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : player.presentTeam?.name && (
                                <div className="item">
                                    <h4>Present Team</h4>
                                    <div className="team" style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                                        <img src={player.presentTeam.logo || "/assets/images/team-placeholder.svg"} alt="" style={{ width: 40, height: 40, objectFit: "contain" }} />
                                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <h6 style={{ margin: 0 }}><a href="#" style={{ color: "#fff", textDecoration: "none" }}>{player.presentTeam.name}</a></h6>
                                            {player.jerseyNumber != null && (
                                                <span style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: 4, fontSize: 12, fontWeight: 600, color: "#FF8C00" }}>
                                                    #{player.jerseyNumber}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section className="leagues-section section-padding">
                <div className="container">
                    <div className="organization-nav-area">
                        <ul>
                            <li className={activeTab === "overview" ? "active" : ""}><Link href={`/players/${id}`}>Overview</Link></li>
                            <li className={activeTab === "stats" ? "active" : ""}><Link href={`/players/${id}/stats`}>Stats</Link></li>
                            <li className={activeTab === "teams" ? "active" : ""}><Link href={`/players/${id}/teams`}>Teams</Link></li>
                            <li className={activeTab === "awards" ? "active" : ""}><Link href={`/players/${id}/awards`}>Awards</Link></li>
                        </ul>
                    </div>
                </div>
            </section>
        </>
    );
}
