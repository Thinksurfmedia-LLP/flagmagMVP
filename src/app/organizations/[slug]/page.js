import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import Season from "@/models/Season";

async function getOrgAndSeasons(slug) {
    await dbConnect();
    const organization = await Organization.findOne({ slug }).lean();
    if (!organization) return { organization: null, activeSeasons: [], pastSeasons: [] };

    const seasons = await Season.find({ organization: organization._id }).sort({ startDate: -1 }).lean();
    const activeSeasons = seasons.filter((s) => s.type === "active");
    const pastSeasons = seasons.filter((s) => s.type === "past");

    return {
        organization: JSON.parse(JSON.stringify(organization)),
        activeSeasons: JSON.parse(JSON.stringify(activeSeasons)),
        pastSeasons: JSON.parse(JSON.stringify(pastSeasons)),
    };
}

function LeagueCard({ season, orgSlug }) {
    return (
        <div className="col-lg-6">
            <div className="leagues-card">
                <div className="badge">{season.category}</div>
                <div className="left">
                    <div className="bg"><img src="/assets/images/teamlogo2.png" alt="" /></div>
                    <img src="/assets/images/teamlogo2.png" alt="" />
                </div>
                <div className="right">
                    <h5>{season.name}</h5>
                    <ul>
                        <li><img src="/assets/images/icon-map.png" alt="" /> Locations - <span>{season.location}</span></li>
                        <li><img src="/assets/images/icon-calander.png" alt="" /> Start date - <span>{new Date(season.startDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "2-digit" })}</span></li>
                        <li><img src="/assets/images/icon-clock.png" alt="" /> Time - <span>{season.time}</span></li>
                    </ul>
                    <div className="button-area">
                        <Link href={`/organizations/${orgSlug}/season/${season.slug}`} className="btn btn-primary">Enter Season</Link>
                        <Link href="#" className="btn btn-info-primary">Sign-In</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default async function OrganizationDetailPage({ params }) {
    const { slug } = await params;
    const { organization: org, activeSeasons, pastSeasons } = await getOrgAndSeasons(slug);

    if (!org) {
        return (
            <>
                <Header />
                <section className="innerpage-section type2">
                    <div className="container py-5 text-center"><h1>Organization not found</h1></div>
                </section>
                <Footer />
            </>
        );
    }

    const categories = org.categories?.length ? org.categories : (org.tags || []);
    const locationText = org.locations?.length
        ? org.locations.map((entry) => entry.locationName).filter(Boolean).join(", ")
        : org.location;

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
                            <div className="logo-area">
                                <img src={org.logo || "/assets/images/teamlogo1.png"} alt="" />
                            </div>
                            <div className="right-part">
                                <h1>{org.name}</h1>
                                <ul>
                                    <li><img src="/assets/images/icon-star.png" alt="" /> <span>{org.rating}</span> ({org.memberCount} members)</li>
                                    <li><img src="/assets/images/icon-calander.png" alt="" /> <span>Founded {org.foundedYear}</span></li>
                                    <li><img src="/assets/images/icon-map.png" alt="" /> <span>{locationText}</span></li>
                                </ul>
                                <ul className="tag">
                                    {categories.map((tag, i) => (
                                        <li key={i}>{tag}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="col-auto button-area">
                            <Link href="#" className="btn btn-primary">Register Now</Link>
                            <Link href="#" className="btn btn-info-primary">Contact Now</Link>
                            <Link href="#" className="btn btn-info-primary">FlagMag+ Stats</Link>
                        </div>
                    </div>

                    <div className="content-area">
                        <h4>about</h4>
                        <p>{org.description}</p>
                        <h4>Locations List</h4>
                        <p>{org.locationsDescription}</p>
                    </div>
                </div>
            </section>

            <section className="leagues-section section-padding">
                <div className="container">
                    <ul className="nav nav-pills leagues-nav" id="pills-tab" role="tablist">
                        <li className="nav-item" role="presentation">
                            <button className="nav-link active" id="leagues-one-tab" data-bs-toggle="pill" data-bs-target="#leagues-one" type="button" role="tab" aria-controls="leagues-one" aria-selected="true">Active Leagues ({activeSeasons.length})</button>
                        </li>
                        <li className="nav-item" role="presentation">
                            <button className="nav-link" id="leagues-two-tab" data-bs-toggle="pill" data-bs-target="#leagues-two" type="button" role="tab" aria-controls="leagues-two" aria-selected="false">Past Leagues ({pastSeasons.length})</button>
                        </li>
                    </ul>

                    <div className="tab-content" id="pills-tabContent">
                        <div className="tab-pane fade show active" id="leagues-one" role="tabpanel" aria-labelledby="leagues-one-tab" tabIndex="0">
                            <div className="row mt-3 g-4">
                                {activeSeasons.length > 0 ? activeSeasons.map((season) => (
                                    <LeagueCard key={season._id} season={season} orgSlug={slug} />
                                )) : (
                                    <div className="col-12 text-center py-4"><p>No active leagues at the moment.</p></div>
                                )}
                            </div>
                        </div>
                        <div className="tab-pane fade" id="leagues-two" role="tabpanel" aria-labelledby="leagues-two-tab" tabIndex="0">
                            <div className="row mt-3 g-4">
                                {pastSeasons.length > 0 ? pastSeasons.map((season) => (
                                    <LeagueCard key={season._id} season={season} orgSlug={slug} />
                                )) : (
                                    <div className="col-12 text-center py-4"><p>No past leagues.</p></div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {org.venues.length > 0 && (
                <section className="venues-section section-padding">
                    <div className="container">
                        <div className="heading-area"><h2>Venues</h2></div>
                        {org.venues.map((venue, i) => (
                            <div key={i} className="row venues-area g-0">
                                <div className="col-lg-6">
                                    <div className="image-area"><img src={venue.image || "/assets/images/venues-img.jpg"} alt="" /></div>
                                </div>
                                <div className="col-lg-6">
                                    <div className="content-area">
                                        <h3>{venue.name}</h3>
                                        <ul>
                                            {venue.amenities.map((a, j) => (
                                                <li key={j}><img src={`/assets/images/v${(j % 6) + 1}.png`} alt="" /> {a}</li>
                                            ))}
                                        </ul>
                                        <Link href="#" className="btn btn-primary">SIGN UP</Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {org.testimonials.length > 0 && (
                <section className="testimonial-section">
                    <div className="container">
                        <div className="heading-area">
                            <h2>Organization Testimonials</h2>
                            <p>Real experiences from league directors who simplified scheduling, reduced admin chaos, and ran smoother seasons.</p>
                        </div>
                        <div className="testimonial-slider">
                            <div className="owl-carousel owl-theme testimonial-carousel">
                                {org.testimonials.map((t, i) => (
                                    <div key={i} className="item testimonial-area">
                                        <div className="card">
                                            <div className="card-header">
                                                <h4>{t.title}</h4>
                                                <img src="/assets/images/star.png" alt="" />
                                            </div>
                                            <div className="card-body"><p>{t.body}</p></div>
                                            <div className="deg">- {t.author}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            <section className="how-it-work-section section-padding-top">
                <div className="container">
                    <div className="heading-area">
                        <h2>Stop Managing Games the Hard Way</h2>
                        <p>If your league relies on manual work, scattered tools, or unreliable stats, it&apos;s time to upgrade to a system built for control and scale.</p>
                    </div>
                    <div className="button-area">
                        <Link href="#" className="btn btn-info-primary">See How It Works</Link>
                        <Link href="#" className="btn btn-primary btn-with-arrow">Talk to Our Team <span><img src="/assets/images/btn-arrow.png" alt="" /></span></Link>
                    </div>
                    <div className="image-area"><img src="/assets/images/ftr-img.png" alt="" /></div>
                </div>
            </section>

            <Footer />
        </>
    );
}
