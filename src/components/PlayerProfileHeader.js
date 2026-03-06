import Link from "next/link";

export default function PlayerProfileHeader({ player, activeTab = "overview" }) {
    const id = player._id;

    return (
        <>
            <section className="innerpage-section type2">
                <div className="banner-area"><img src={player.bannerImage || "/assets/images/player-banner.jpg"} alt="" /></div>
                <div className="container"></div>
            </section>

            <section className="organization-details-section players-details-section">
                <div className="container">
                    <div className="row">
                        <div className="col info-area">
                            <div className="logo-area">
                                <img src={player.photo || "/assets/images/player1.jpg"} alt="" />
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
                                    <h4>Locations List</h4>
                                    <p>{player.locationsDescription}</p>
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
                            {player.presentTeam?.name && (
                                <div className="item">
                                    <h4>Present Team</h4>
                                    <div className="team">
                                        <img src={player.presentTeam.logo || "/assets/images/team1.jpg"} alt="" />
                                        <h6><a href="#">{player.presentTeam.name}</a></h6>
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
                            <li className={activeTab === "organization" ? "active" : ""}><Link href="#">Organization</Link></li>
                            <li className={activeTab === "awards" ? "active" : ""}><Link href={`/players/${id}/awards`}>Awards</Link></li>
                        </ul>
                    </div>
                </div>
            </section>
        </>
    );
}
