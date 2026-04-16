"use client";

import { useEffect, useState } from "react";

export default function Footer() {
    const [settings, setSettings] = useState(null);

    useEffect(() => {
        fetch("/api/site-settings")
            .then((r) => r.json())
            .then((data) => { if (data.success) setSettings(data.data); })
            .catch(() => { });
    }, []);

    const phone = settings?.phone;
    const email = settings?.email;
    const address = settings?.address;
    const facebook = settings?.facebook;
    const twitter = settings?.twitter;
    const instagram = settings?.instagram;
    const youtube = settings?.youtube;

    const hasContact = phone || email || address;
    const hasSocial = facebook || twitter || instagram || youtube;

    return (
        <footer>
            <div className="container">
                <div className="top-area">
                    <img src="/assets/images/logo.png" alt="Flagmag Logo" />
                    {hasContact && (
                        <ul className="contact">
                            {phone && (
                                <li>
                                    <a href={`tel:${phone}`}>
                                        <i className="fa-solid fa-phone"></i> {phone}
                                    </a>
                                </li>
                            )}
                            {email && (
                                <li>
                                    <a href={`mailto:${email}`}>
                                        <i className="fa-regular fa-envelope"></i> {email}
                                    </a>
                                </li>
                            )}
                            {address && (
                                <li>
                                    <a href="#">
                                        <i className="fa-solid fa-location-dot"></i> {address}
                                    </a>
                                </li>
                            )}
                        </ul>
                    )}
                    {hasSocial && (
                        <ul className="contact social-icon">
                            {facebook && (
                                <li>
                                    <a href={facebook} target="_blank" rel="noopener noreferrer">
                                        <i className="fa-brands fa-facebook-f"></i>
                                    </a>
                                </li>
                            )}
                            {twitter && (
                                <li>
                                    <a href={twitter} target="_blank" rel="noopener noreferrer">
                                        <i className="fa-brands fa-x-twitter"></i>
                                    </a>
                                </li>
                            )}
                            {instagram && (
                                <li>
                                    <a href={instagram} target="_blank" rel="noopener noreferrer">
                                        <i className="fa-brands fa-instagram"></i>
                                    </a>
                                </li>
                            )}
                            {youtube && (
                                <li>
                                    <a href={youtube} target="_blank" rel="noopener noreferrer">
                                        <i className="fa-brands fa-youtube"></i>
                                    </a>
                                </li>
                            )}
                        </ul>
                    )}
                </div>
            </div>

            <div className="copyright-area">
                <div className="container">
                    <div className="row align-items-center">
                        <div className="col-md mb-2 mb-md-0">
                            <p>All Rights Reserved © 2026</p>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
