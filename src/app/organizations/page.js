import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import dbConnect from "@/lib/dbConnect";
import Organization from "@/models/Organization";

async function getOrganizations() {
    await dbConnect();
    const organizations = await Organization.find({})
        .sort({ createdAt: -1 })
        .lean();
    return JSON.parse(JSON.stringify(organizations));
}

function OrgCard({ org }) {
    const categories = org.categories?.length ? org.categories : (org.tags || []);
    const locationText = org.locations?.length
        ? org.locations.map((entry) => entry.locationName).filter(Boolean).join(", ")
        : org.location;

    return (
        <div className="col-xxl-3 col-xl-4 col-md-6 mb-4">
            <div className="team-area card">
                <div className="image-area">
                    <div className="bg"><img src={org.logo || "/assets/images/teamlogo1.png"} alt="" /></div>
                    <img src={org.logo || "/assets/images/teamlogo1.png"} alt="" />
                </div>
                <div className="card-body">
                    <div className="rating">
                        <img src="/assets/images/icon-star.png" alt="" /> <span>{org.rating}</span> ({org.memberCount} members)
                        <div className="icon">
                            <img src="/assets/images/icon1.png" alt="" />
                        </div>
                    </div>
                    <div className="content-part">
                        <h3>{org.name}</h3>
                        <ul className="tag">
                            {categories.map((tag, i) => (
                                <li key={i}>{tag}</li>
                            ))}
                        </ul>
                        <h4><img src="/assets/images/icon-map.png" alt="" /> {locationText}</h4>
                        <h4><img src="/assets/images/icon-calander.png" alt="" /> {org.scheduleDays.join(", ")}</h4>
                    </div>
                </div>
                <div className="button-area">
                    <Link href={`/organizations/${org.slug}`} className="btn btn-primary">View Details</Link>
                </div>
            </div>
        </div>
    );
}

export default async function OrganizationsPage() {
    const organizations = await getOrganizations();

    return (
        <>
            <Header />

            <section className="innerpage-section">
                <div className="banner-area"><img src="/assets/images/inner-banner1.jpg" alt="" /></div>
                <div className="container">
                    <div className="breadcrumb-area">
                        <h1>Explore the FlagMag Ecosystem </h1>
                        <p>Organizations &amp; teams Shaping the Game.</p>
                    </div>
                </div>
            </section>

            <section className="organization-team-section section-padding">
                <div className="container">
                    <div className="search-part">
                        <input type="text" className="form-control" placeholder="Search Organizations..." />
                        <div className="row justify-content-between mt-3">
                            <div className="col-auto">
                                <select className="form-select" aria-label="All Sports">
                                    <option defaultValue>All Sports</option>
                                    <option value="Flag Football">Flag Football</option>
                                    <option value="Soccer">Soccer</option>
                                    <option value="Basketball">Basketball</option>
                                    <option value="Pickleball">Pickleball</option>
                                </select>
                                <select className="form-select" aria-label="All Locations">
                                    <option defaultValue>All Locations</option>
                                    <option value="New York">New York</option>
                                    <option value="Los Angeles">Los Angeles</option>
                                    <option value="Chicago">Chicago</option>
                                    <option value="Boston">Boston</option>
                                </select>
                                <select className="form-select" aria-label="League Type">
                                    <option defaultValue>League Type</option>
                                    <option value="Coed">Coed</option>
                                    <option value="Men's">Men&apos;s</option>
                                    <option value="Women's">Women&apos;s</option>
                                    <option value="Youth">Youth</option>
                                </select>
                            </div>
                            <div className="col-auto sort-part">
                                <h6>Sort by:</h6>
                                <select className="form-select" aria-label="Sort">
                                    <option defaultValue>Featured</option>
                                    <option value="a-z">A to Z</option>
                                    <option value="z-a">Z to A</option>
                                    <option value="rating">Rating</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="team-main-wrapper">
                        <h6 className="item-count">Showing {organizations.length} organizations</h6>
                        <div className="row">
                            {organizations.map((org) => (
                                <OrgCard key={org._id} org={org} />
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}
