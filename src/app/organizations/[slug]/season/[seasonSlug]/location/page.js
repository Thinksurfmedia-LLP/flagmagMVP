import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GalleryCarousel from "@/components/GalleryCarousel";
import Link from "next/link";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";
import Venue from "@/models/Location";
import League from "@/models/League";
import Player from "@/models/Player";
import County from "@/models/County";
import State from "@/models/State";
import Amenity from "@/models/Amenity";
import { formatOrganizationLocations } from "@/lib/organizationLocations";

async function getData(slug, seasonSlug) {
    await dbConnect();
    const org = await Organization.findOne({ slug }).lean();
    if (!org) return null;
    const league = await League.findOne({ organization: org._id, slug: seasonSlug }).lean();
    if (!league) return null;

    const playerCount = await Player.countDocuments({ organization: org._id });

    // Only show venues that are assigned to this league
    const leagueVenueNames = (league.locations || []).filter(Boolean);
    if (leagueVenueNames.length === 0) {
        // No locations assigned to this league
        const amenities = await Amenity.find({}).lean();
        const amenityIconMap = {};
        amenities.forEach((a) => { amenityIconMap[a.name] = a.icon || ""; });
        return {
            org: JSON.parse(JSON.stringify({ ...org, playerCount })),
            league: JSON.parse(JSON.stringify(league)),
            locations: [],
            amenityIconMap,
        };
    }

    const orgLocs = org.locations || [];
    const matchedVenues = await Venue.find({ name: { $in: leagueVenueNames } })
        .populate({ path: "county", select: "name state", populate: { path: "state", select: "name abbreviation" } })
        .lean();

    // Build locations array pairing each matched venue with org location info
    const locationsWithVenues = matchedVenues.map((v) => {
        const matchingLoc = orgLocs.find((l) => l.stateAbbr === (v.county?.state?.abbreviation || "") && l.countyName === (v.county?.name || ""));
        return {
            ...(matchingLoc || {}),
            venue: JSON.parse(JSON.stringify(v)),
        };
    });

    // Fetch amenity icons from DB
    const amenities = await Amenity.find({}).lean();
    const amenityIconMap = {};
    amenities.forEach((a) => { amenityIconMap[a.name] = a.icon || ""; });

    return {
        org: JSON.parse(JSON.stringify({ ...org, playerCount })),
        league: JSON.parse(JSON.stringify(league)),
        locations: locationsWithVenues,
        amenityIconMap,
    };
}

export default async function SeasonLocationPage({ params }) {
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

    const { org, league, locations, amenityIconMap } = data;
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
                            <li className="active"><Link href={`/organizations/${slug}/season/${seasonSlug}/location`}>Location</Link></li>
                            <li><Link href={`/organizations/${slug}/season/${seasonSlug}/media`}>Media</Link></li>
                        </ul>
                    </div>

                    <div className="location-item-wrapper">
                        {locations.map((loc, locIdx) => {
                            const venue = loc.venue;
                            if (!venue) return null;
                            const fields = venue.fields || [];
                            if (fields.length === 0) return null;

                            return fields.map((field, fieldIdx) => {
                                const allAmenities = [...(field.amenities || [])];

                                const images = field.images || [];

                                return (
                                    <div className="location-item" key={`${locIdx}-${fieldIdx}`}>
                                        <div className="row gx-5">
                                            <div className="col-lg-auto">
                                                <div className="map-area">
                                                    {field.mapEmbed ? (
                                                        <div dangerouslySetInnerHTML={{ __html: field.mapEmbed }} />
                                                    ) : (
                                                        <img src="/assets/images/map.jpg" alt="" />
                                                    )}
                                                </div>
                                            </div>
                                            <div className="col-lg map-content-area">
                                                <h3>{venue.name}</h3>
                                                <ul>
                                                    {allAmenities.map((amenity, aIdx) => (
                                                        <li key={aIdx}>
                                                            {amenityIconMap[amenity] && <img src={amenityIconMap[amenity]} alt="" />} {amenity}
                                                        </li>
                                                    ))}
                                                    <li><img src="/assets/images/v8.png" alt="" /> Field: {field.name}</li>
                                                    <li>
                                                        <img src="/assets/images/v7.png" alt="" /> Location – {venue.cityName || loc.cityName || ""}
                                                    </li>
                                                </ul>
                                            </div>
                                        </div>

                                        {images.length > 0 && (
                                            <>
                                                <hr />
                                                <GalleryCarousel images={images} galleryId={`gallery-${locIdx}-${fieldIdx}`} />
                                            </>
                                        )}
                                    </div>
                                );
                            });
                        })}
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}
