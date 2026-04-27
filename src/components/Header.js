"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HeaderAuth from "@/components/HeaderAuth";

export default function Header({ variant = "default", onBookDemo }) {
    const [settings, setSettings] = useState(null);

    useEffect(() => {
        fetch("/api/site-settings")
            .then((r) => r.json())
            .then((data) => { if (data.success) setSettings(data.data); })
            .catch(() => { });
    }, []);

    const headerClass = variant === "homepage"
        ? "for-homepage"
        : variant === "signup"
            ? "for-signup"
            : "";

    const facebook = settings?.facebook;
    const twitter = settings?.twitter;
    const instagram = settings?.instagram;
    const youtube = settings?.youtube;
    const hasSocial = facebook || twitter || instagram || youtube;

    return (
        <header className={headerClass}>
            {/* <div className="top-header">
                <p>At the top - Flagmag has been industry leader in Flag Football for over 30 years!</p>
            </div> */}
            <div className="container-fluid">
                <div className="row justify-content-between align-items-center">
                    <div className="col-auto logo">
                        <Link href="/">
                            <img src="/assets/images/logo.png" alt="Logo" />
                        </Link>
                    </div>

                    <div className="col header-nav d-flex">
                        <nav className="navbar navbar-expand-lg">
                            <div className="container-fluid">
                                {/* Toggler */}
                                <button
                                    className="navbar-toggler"
                                    type="button"
                                    data-bs-toggle="offcanvas"
                                    data-bs-target="#mobileMenu"
                                    aria-controls="mobileMenu"
                                    aria-expanded="false"
                                    aria-label="Toggle navigation"
                                >
                                    <i className="fa-solid fa-bars-staggered"></i>
                                </button>

                                {/* Desktop Menu */}
                                <div className="collapse navbar-collapse d-none d-lg-flex" id="navbarText">
                                    <ul className="navbar-nav me-auto mb-lg-0">
                                        {/* <li className="nav-item"><Link className="nav-link" href="#">Features</Link></li> */}
                                        <li className="nav-item"><Link className="nav-link" href="/organizations">Leagues</Link></li>
                                        <li className="nav-item"><Link className="nav-link" href="/stats">Stats</Link></li>
                                        {/* <li className="nav-item"><Link className="nav-link" href="#">Tournaments</Link></li> */}
                                        <li className="nav-item"><Link className="nav-link" href="/store">Store</Link></li>
                                        <li className="nav-item"><Link className="nav-link" href="/sponsors">Sponsors</Link></li>
                                        {/* <li className="nav-item"><Link className="nav-link" href="#">Resources</Link></li> */}
                                    </ul>
                                </div>

                                {/* Offcanvas Mobile Menu */}
                                <div className="offcanvas offcanvas-end d-lg-none" tabIndex="-1" id="mobileMenu">
                                        <div className="offcanvas-header">
                                            <div className="offcanvas-logo">
                                                <img src="/assets/images/logo.png" alt="" />
                                            </div>
                                            <button type="button" className="btn-close" data-bs-dismiss="offcanvas"></button>
                                        </div>
                                        <div className="offcanvas-body">
                                            <ul className="navbar-nav">
                                                {/* <li className="nav-item"><Link className="nav-link" href="#">Features</Link></li> */}
                                                <li className="nav-item"><Link className="nav-link" href="/organizations">Leagues</Link></li>
                                                <li className="nav-item"><Link className="nav-link" href="/stats">Stats</Link></li>
                                                {/* <li className="nav-item"><Link className="nav-link" href="#">Tournaments</Link></li> */}
                                                <li className="nav-item"><Link className="nav-link" href="/store">Store</Link></li>
                                                <li className="nav-item"><Link className="nav-link" href="/sponsors">Sponsors</Link></li>
                                                {/* <li className="nav-item"><Link className="nav-link" href="#">Resources</Link></li> */}
                                            </ul>
                                            <HeaderAuth className="for-mobile" onBookDemo={onBookDemo} />
                                            {hasSocial && (
                                                <div className="social">
                                                    <h5>Follow Us on</h5>
                                                    <ul>
                                                        {facebook && <li><a href={facebook} target="_blank" rel="noopener noreferrer"><i className="fa-brands fa-facebook-f"></i></a></li>}
                                                        {twitter && <li><a href={twitter} target="_blank" rel="noopener noreferrer"><i className="fa-brands fa-x-twitter"></i></a></li>}
                                                        {instagram && <li><a href={instagram} target="_blank" rel="noopener noreferrer"><i className="fa-brands fa-instagram"></i></a></li>}
                                                        {youtube && <li><a href={youtube} target="_blank" rel="noopener noreferrer"><i className="fa-brands fa-youtube"></i></a></li>}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                            </div>
                        </nav>
                        <HeaderAuth onBookDemo={onBookDemo} />
                    </div>
                </div>
            </div>
        </header>
    );
}

