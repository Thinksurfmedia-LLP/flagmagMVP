"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

const FALLBACK_BANNERS = ["/assets/images/sb1.png", "/assets/images/sb2.png", "/assets/images/sb3.png"];
const OWL_RETRY_MS = 200;

const OWL_OPTIONS = {
    loop: false,
    margin: 10,
    nav: true,
    dots: false,
    autoplay: false,
    navText: [""],
    responsive: {
        0: { items: 1, nav: false },
        600: { items: 2, nav: true },
        1200: { items: 3 },
    },
};

/** "Shop by Activity" banner carousel: one tile per category that has active products. */
export default function ActivityCarousel({ categories }) {
    const carouselRef = useRef(null);
    const tiles = categories.filter((c) => c.activeCount > 0);
    const tileKey = tiles.map((c) => `${c.slug}|${c.image || ""}`).join(",");

    useEffect(() => {
        if (!tileKey || !carouselRef.current) return undefined;
        let destroyed = false;
        let retry = null;

        const destroy = () => {
            const $ = window.jQuery;
            const el = carouselRef.current;
            if ($ && el && $(el).hasClass("owl-loaded")) $(el).trigger("destroy.owl.carousel");
        };
        const tryInit = () => {
            if (destroyed || !carouselRef.current) return;
            const $ = window.jQuery;
            if (!$ || !$.fn.owlCarousel) {
                retry = setTimeout(tryInit, OWL_RETRY_MS);
                return;
            }
            destroy();
            $(carouselRef.current).owlCarousel(OWL_OPTIONS);
        };

        tryInit();
        return () => {
            destroyed = true;
            clearTimeout(retry);
            destroy();
        };
    }, [tileKey]);

    if (tiles.length === 0) return null;

    return (
        <section className="store-banner-section section-padding-top" id="main-content">
            <div className="container">
                <div className="row align-items-center text-center gy-3 justify-content-between mb-4">
                    <div className="col-sm-auto">
                        <h2>Shop by Activity</h2>
                    </div>
                    <div className="col-sm-auto">
                        <Link href="/store" className="btn btn-primary">See All</Link>
                    </div>
                </div>

                <div className="store-banner-carousel-wrapper">
                    <div ref={carouselRef} className="store-banner-carousel owl-carousel owl-theme">
                        {tiles.map((c, i) => (
                            <div className="item" key={c.slug}>
                                <Link href={`/store?category=${encodeURIComponent(c.slug)}`} aria-label={c.name}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={c.image || FALLBACK_BANNERS[i % FALLBACK_BANNERS.length]} alt={c.name} />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
