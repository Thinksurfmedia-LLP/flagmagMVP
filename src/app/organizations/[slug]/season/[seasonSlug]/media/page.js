import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MediaGrid from "@/components/MediaGrid";
import Link from "next/link";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import Venue from "@/models/Location";
import League from "@/models/League";
import Player from "@/models/Player";
import County from "@/models/County";
import State from "@/models/State";
import { formatOrganizationLocations } from "@/lib/organizationLocations";

async function getData(slug, seasonSlug) {
    await dbConnect();
    const org = await Organization.findOne({ slug }).lean();
    if (!org) return null;
    const league = await League.findOne({ organization: org._id, slug: seasonSlug }).lean();
    if (!league) return null;

    const playerCount = await Player.countDocuments({ organization: org._id });

    // Match venues to org locations by stateAbbr + countyName
    const orgLocs = org.locations || [];
    const allVenues = await Venue.find({})
        .populate({ path: "county", select: "name state", populate: { path: "state", select: "name abbreviation" } })
        .lean();

    const matchedVenues = allVenues.filter((v) => {
        const vStateAbbr = v.county?.state?.abbreviation || "";
        const vCountyName = v.county?.name || "";
        return orgLocs.some((l) => l.stateAbbr === vStateAbbr && l.countyName === vCountyName);
    });

    const allImages = [];
    matchedVenues.forEach((v) => {
        (v.fields || []).forEach((f) => {
            (f.images || []).forEach((img) => {
                allImages.push(img);
            });
        });
    });

    return {
        org: JSON.parse(JSON.stringify({ ...org, playerCount })),
        league: JSON.parse(JSON.stringify(league)),
        images: allImages,
    };
}

export default async function SeasonMediaPage({ params }) {
    const { slug, seasonSlug } = await params;
    const data = await getData(slug, seasonSlug);

    if (!data) {
        return (
            <>
                <Header />
                <section className="innerpage-section type2">
                    <div className="container py-5 text-center"><h1>Season not found</h1></div>
                </section>
                <Footer />
            </>
        );
    }

    const { org, league, images } = data;
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
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/game-stats`}>Standings</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/player-stats`}>Player Stats</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/location`}>Location</Link></li>
                            <li className="active"><Link href={`/organizations/${slug}/season/${seasonSlug}/media`}>Media</Link></li>
                        </ul>
                    </div>

                    <MediaGrid images={images} />
                </div>
            </section>

            <Footer />
        </>
    );
}
