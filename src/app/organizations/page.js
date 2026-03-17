"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";

function OrgCard({ org }) {
    const categories = org.categories || [];
    const cities = (org.locations || [])
        .map((loc) => loc.cityName || loc.countyName)
        .filter(Boolean);
    const visibleCities = cities.slice(0, 2);
    const extraCount = cities.length - 2;
    const locationText = visibleCities.join(", ") + (extraCount > 0 ? ` +${extraCount}` : "");

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
                        <h4><img src="/assets/images/icon-calander.png" alt="" /> {(org.scheduleDays || []).join(", ")}</h4>
                    </div>
                </div>
                <div className="button-area">
                    <Link href={`/organizations/${org.slug}`} className="btn btn-primary">View Details</Link>
                </div>
            </div>
        </div>
    );
}

export default function OrganizationsPage() {
    const [organizations, setOrganizations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sport, setSport] = useState("");
    const [location, setLocation] = useState("");
    const [category, setCategory] = useState("");
    const [sort, setSort] = useState("featured");
    const [filterOptions, setFilterOptions] = useState({ locations: [], sports: [], categories: [] });

    // Load filter options once
    useEffect(() => {
        fetch("/api/organizations?filtersOnly=true")
            .then((r) => r.json())
            .then((d) => { if (d.success) setFilterOptions(d.data); })
            .catch(() => {});
    }, []);

    const fetchOrgs = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (sport) params.set("sport", sport);
        if (location) params.set("location", location);
        if (category) params.set("category", category);
        if (sort) params.set("sort", sort);
        try {
            const res = await fetch(`/api/organizations?${params.toString()}`);
            const data = await res.json();
            if (data.success) setOrganizations(data.data);
        } catch { /* ignore */ }
        finally { setLoading(false); }
    }, [search, sport, location, category, sort]);

    useEffect(() => { fetchOrgs(); }, [fetchOrgs]);

    // Debounce search
    const [searchInput, setSearchInput] = useState("");
    useEffect(() => {
        const t = setTimeout(() => setSearch(searchInput), 400);
        return () => clearTimeout(t);
    }, [searchInput]);

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
                        <input
                            type="text"
                            className="form-control"
                            placeholder="Search Organizations..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                        />
                        <div className="row justify-content-between mt-3">
                            <div className="col-auto">
                                <select className="form-select" value={sport} onChange={(e) => setSport(e.target.value)}>
                                    <option value="">All Sports</option>
                                    {filterOptions.sports.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                                <select className="form-select" value={location} onChange={(e) => setLocation(e.target.value)}>
                                    <option value="">All Locations</option>
                                    {filterOptions.locations.map((l) => (
                                        <option key={l} value={l}>{l}</option>
                                    ))}
                                </select>
                                <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)}>
                                    <option value="">League Type</option>
                                    {filterOptions.categories.map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-auto sort-part">
                                <h6>Sort by:</h6>
                                <select className="form-select" value={sort} onChange={(e) => setSort(e.target.value)}>
                                    <option value="featured">Featured</option>
                                    <option value="a-z">A to Z</option>
                                    <option value="z-a">Z to A</option>
                                    <option value="rating">Rating</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="team-main-wrapper">
                        <h6 className="item-count">
                            {loading ? "Loading..." : `Showing ${organizations.length} organizations`}
                        </h6>
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
