"use client";

import { useState } from "react";
import ImageLightbox from "@/components/store/ImageLightbox";

const FALLBACK_IMAGE = "/assets/images/product1.jpg";
const THUMB_SLOTS = 4;
// Four thumbnails per row (the template's slick row); 10px gaps from style.css.
const thumbItemStyle = { flex: "0 0 calc((100% - 30px) / 4)", minWidth: 0 };
// style.css pads every thumb li 0 8px and li.more::after covers the whole li; move that
// padding to margin so the "+N More" overlay sits exactly over the rounded image.
const moreItemStyle = {
    flex: "0 0 calc((100% - 30px) / 4 - 16px)",
    minWidth: 0,
    margin: "0 8px",
    padding: 0,
    borderRadius: 10,
    overflow: "hidden",
};
const thumbButtonStyle = { padding: 0, border: 0, background: "none", width: "100%", display: "block", cursor: "pointer" };
const thumbImgStyle = { width: "100%", display: "block" };

const indexOrZero = (list, src) => Math.max(0, src ? list.indexOf(src) : 0);

/**
 * Main image + `.thumb-nav` from the template. Clicking the main image or the
 * "+N More" tile opens the lightbox. `activeImage` (a colour's photo) switches the slide.
 * @param {{ images: string[], name: string, activeImage?: string }} props
 */
export default function ProductGallery({ images, name, activeImage }) {
    const list = images && images.length > 0 ? images : [FALLBACK_IMAGE];
    const [active, setActive] = useState(() => indexOrZero(list, activeImage));
    const [shownFor, setShownFor] = useState(activeImage);
    const [lightboxIndex, setLightboxIndex] = useState(null);

    // A new colour photo switches the slide (React's "adjust state on prop change" pattern).
    if (activeImage !== shownFor) {
        setShownFor(activeImage);
        if (activeImage && list.includes(activeImage)) setActive(list.indexOf(activeImage));
    }

    const current = Math.min(active, list.length - 1);
    const hasMore = list.length > THUMB_SLOTS;
    const thumbs = list.slice(0, hasMore ? THUMB_SLOTS - 1 : THUMB_SLOTS);
    const moreIndex = THUMB_SLOTS - 1;

    const open = (index) => (event) => {
        event.preventDefault();
        setLightboxIndex(index);
    };

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
        <div className="product-images demo-gallery" tabIndex={0} onKeyDown={onKeyDown} aria-label={`${name} images`}>
            <div className="main-img-slider product-image-slider">
                <a href={list[current]} onClick={open(current)} aria-label={`Open ${name} image ${current + 1} full screen`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={list[current]} className="img-fluid" alt={name} style={{ width: "100%", display: "block" }} />
                </a>
            </div>
            {list.length > 1 && (
                <ul className="thumb-nav">
                    {thumbs.map((src, index) => (
                        <li key={`${src}-${index}`} style={thumbItemStyle}>
                            <button type="button" style={thumbButtonStyle} onClick={() => setActive(index)}
                                aria-label={`Show image ${index + 1}`} aria-current={index === current}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={src} alt="" style={thumbImgStyle} />
                            </button>
                        </li>
                    ))}
                    {hasMore && (
                        <li className="more" style={moreItemStyle}>
                            <a href={list[moreIndex]} onClick={open(moreIndex)} aria-label={`Show all ${list.length} images`}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={list[moreIndex]} alt="" style={thumbImgStyle} />
                                <span>{`+${list.length - THUMB_SLOTS} More`}</span>
                            </a>
                        </li>
                    )}
                </ul>
            )}
            {lightboxIndex !== null && (
                <ImageLightbox images={list} index={lightboxIndex} name={name}
                    onIndexChange={setLightboxIndex} onClose={() => setLightboxIndex(null)} />
            )}
        </div>
    );
}
