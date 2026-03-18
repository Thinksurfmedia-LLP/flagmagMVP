"use client";

import { useEffect, useRef, useState } from "react";

export default function GalleryCarousel({ images = [], galleryId = "gallery" }) {
    const carouselRef = useRef(null);
    const [lightboxIdx, setLightboxIdx] = useState(null);

    useEffect(() => {
        if (!images.length || !carouselRef.current) return;

        let destroyed = false;

        const tryInit = () => {
            if (destroyed || !carouselRef.current) return;
            const $ = window.jQuery;
            if (!$ || !$.fn.owlCarousel) {
                setTimeout(tryInit, 200);
                return;
            }
            const $el = $(carouselRef.current);
            if ($el.hasClass("owl-loaded")) $el.trigger("destroy.owl.carousel");
            $el.owlCarousel({
                loop: true,
                margin: 10,
                nav: true,
                dots: false,
                autoplay: true,
                autoplayTimeout: 3000,
                navText: [""],
                responsive: {
                    0: { items: 2, nav: false },
                    600: { items: 2, nav: true },
                    1000: { items: 3 },
                    1200: { items: 4 },
                    1400: { items: 5 },
                },
            });
        };

        tryInit();
        return () => {
            destroyed = true;
            if (carouselRef.current && window.jQuery) {
                const $ = window.jQuery;
                const $el = $(carouselRef.current);
                if ($el.hasClass("owl-loaded")) $el.trigger("destroy.owl.carousel");
            }
        };
    }, [images]);

    if (!images.length) return null;

    return (
        <>
            <div className="gallery-area">
                <h5>See venue photos</h5>
                <div ref={carouselRef} className="owl-carousel owl-theme gallery-carousel">
                    {images.map((url, i) => (
                        <div className="item" key={i}>
                            <a
                                href={url}
                                onClick={(e) => { e.preventDefault(); setLightboxIdx(i); }}
                                style={{ cursor: "pointer" }}
                            >
                                <img src={url} alt={`Photo ${i + 1}`} />
                            </a>
                        </div>
                    ))}
                </div>
            </div>

            {lightboxIdx !== null && (
                <div
                    style={{
                        position: "fixed", inset: 0, zIndex: 99999,
                        background: "rgba(0,0,0,0.92)", display: "flex",
                        alignItems: "center", justifyContent: "center",
                    }}
                    onClick={() => setLightboxIdx(null)}
                >
                    <button
                        onClick={() => setLightboxIdx(null)}
                        style={{
                            position: "absolute", top: 20, right: 20, background: "none",
                            border: "none", color: "#fff", fontSize: 32, cursor: "pointer", zIndex: 10,
                        }}
                    >&times;</button>

                    {images.length > 1 && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx - 1 + images.length) % images.length); }}
                                style={{
                                    position: "absolute", left: 20, top: "50%", transform: "translateY(-50%)",
                                    background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
                                    fontSize: 28, width: 48, height: 48, borderRadius: "50%", cursor: "pointer", zIndex: 10,
                                }}
                            >&#8249;</button>
                            <button
                                onClick={(e) => { e.stopPropagation(); setLightboxIdx((lightboxIdx + 1) % images.length); }}
                                style={{
                                    position: "absolute", right: 20, top: "50%", transform: "translateY(-50%)",
                                    background: "rgba(255,255,255,0.15)", border: "none", color: "#fff",
                                    fontSize: 28, width: 48, height: 48, borderRadius: "50%", cursor: "pointer", zIndex: 10,
                                }}
                            >&#8250;</button>
                        </>
                    )}

                    <img
                        src={images[lightboxIdx]}
                        alt=""
                        onClick={(e) => e.stopPropagation()}
                        style={{ maxWidth: "90vw", maxHeight: "85vh", objectFit: "contain", borderRadius: 8 }}
                    />
                </div>
            )}
        </>
    );
}
