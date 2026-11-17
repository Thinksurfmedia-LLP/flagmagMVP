"use client";

import { useRef, useState } from "react";
import ImageLightbox from "@/components/store/ImageLightbox";

const FALLBACK_IMAGE = "/assets/images/product1.jpg";
const THUMB_SLOTS = 4;
const SWIPE_THRESHOLD_PX = 40;
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
    const dragStartX = useRef(null);
    const didSwipe = useRef(false);

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
        if (didSwipe.current) {
            didSwipe.current = false;
            return; // the pointer moved far enough to be a swipe, not a click
        }
        setLightboxIndex(index);
    };

    const onPointerDown = (event) => {
        dragStartX.current = event.clientX;
        didSwipe.current = false;
    };
    const onPointerUp = (event) => {
        const start = dragStartX.current;
        dragStartX.current = null;
        if (start === null || list.length < 2) return;
        const dx = event.clientX - start;
        if (Math.abs(dx) <= SWIPE_THRESHOLD_PX) return;
        didSwipe.current = true;
        setActive((current + (dx < 0 ? 1 : -1) + list.length) % list.length);
    };
    const onPointerCancel = () => { dragStartX.current = null; };

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
            <div className="main-img-slider product-image-slider" style={{ touchAction: "pan-y" }}
                onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerCancel}>
                <a href={list[current]} onClick={open(current)} aria-label={`Open ${name} image ${current + 1} full screen`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={list[current]} className="img-fluid" alt={name} draggable={false} style={{ width: "100%", display: "block" }} />
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
                            <a href={list[moreIndex]} onClick={open(moreIndex)} style={{ display: "block" }} aria-label={`Show all ${list.length} images`}>
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
