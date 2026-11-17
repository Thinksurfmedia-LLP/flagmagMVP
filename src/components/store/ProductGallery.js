"use client";

import { useState } from "react";

const FALLBACK_IMAGE = "/assets/images/product1.jpg";

/** @param {{ images: string[], name: string }} props */
export default function ProductGallery({ images, name }) {
    const list = images && images.length > 0 ? images : [FALLBACK_IMAGE];
    const [active, setActive] = useState(0);
    const current = Math.min(active, list.length - 1);

    const onKeyDown = (event) => {
        if (event.key === "ArrowRight") {
            event.preventDefault();
            setActive((current + 1) % list.length);
        } else if (event.key === "ArrowLeft") {
            event.preventDefault();
            setActive((current - 1 + list.length) % list.length);
        }
    };

    return (
        <div className="product-images demo-gallery" tabIndex={0} style={{ width: "100%" }} onKeyDown={onKeyDown} aria-label={`${name} images`}>
            <div className="main-img-slider product-image-slider">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={list[current]} className="img-fluid" alt={name} style={{ width: "100%", height: "auto", display: "block" }} />
            </div>
            {list.length > 1 && (
                <ul className="thumb-nav" style={{ padding: 0, listStyle: "none" }}>
                    {list.map((src, index) => (
                        <li key={`${src}-${index}`} style={{ listStyle: "none" }}>
                            <button
                                type="button"
                                onClick={() => setActive(index)}
                                aria-label={`Show image ${index + 1}`}
                                aria-current={index === current}
                                style={{
                                    padding: 0,
                                    background: "none",
                                    border: index === current ? "2px solid #FF1E00" : "2px solid transparent",
                                    borderRadius: 10,
                                    width: 90,
                                    overflow: "hidden",
                                    display: "block",
                                }}
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={src} alt="" style={{ width: "100%", display: "block" }} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
