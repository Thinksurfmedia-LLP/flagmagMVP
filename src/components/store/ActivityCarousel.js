"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/store/pricing";

const TILE_STYLE = {
    display: "flex", alignItems: "center", gap: 12, aspectRatio: "456 / 314", padding: "0 16px",
    borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)", overflow: "hidden", color: "#fff",
    background: "linear-gradient(120deg, #1D1F24 29%, #0B0C10 100%)",
};
const DISPLAY_FONT = { fontFamily: '"Cros", sans-serif', textTransform: "uppercase" };

/** Generated tile in the template banner's style, from real category data. */
function GeneratedTile({ category }) {
    const { name, coverImage, minPrice, bestDiscountPercent } = category;
    return (
        <div style={TILE_STYLE}>
            <div style={{ flex: "0 0 45%", height: "100%", display: "flex", alignItems: "center" }}>
                {coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverImage} alt="" style={{ width: "100%", maxHeight: "86%", objectFit: "contain" }} />
                )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ ...DISPLAY_FONT, color: "#fff", fontSize: "clamp(1.4rem, 2.6vw, 2.4rem)", lineHeight: 1, margin: "0 0 8px", overflowWrap: "anywhere" }}>{name}</h4>
                {minPrice !== null && (
                    <div style={{ fontSize: 14 }}>
                        <small style={{ color: "#9a9a9a", marginRight: 4 }}>From</small>
                        <strong>{formatPrice(minPrice)}</strong>
                        {bestDiscountPercent !== null && (
                            <div style={{ color: "#FF1E00", fontSize: 12 }}>({bestDiscountPercent}% OFF)</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
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
    const tileKey = tiles.map((c) => `${c.slug}|${c.image || ""}|${c.minPrice}|${c.bestDiscountPercent}|${c.coverImage || ""}`).join(",");

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
                        {tiles.map((c) => (
                            <div className="item" key={c.slug}>
                                <Link href={`/store?category=${encodeURIComponent(c.slug)}`} aria-label={c.name}>
                                    {c.image ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={c.image} alt={c.name} />
                                    ) : (
                                        <GeneratedTile category={c} />
                                    )}
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
