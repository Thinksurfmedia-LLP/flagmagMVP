"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE = "button:not([disabled])";

const overlayStyle = {
    position: "fixed",
    inset: 0,
    zIndex: 100000,
    background: "rgba(12, 13, 17, 0.94)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "60px 70px",
};
const roundBtn = {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    background: "rgba(0, 0, 0, 0.5)",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
};
const counterStyle = { position: "absolute", top: 22, left: 24, color: "#fff", fontSize: 14 };

/**
 * Full-screen image viewer (stands in for the template's fancybox gallery).
 * @param {{ images: string[], index: number, name: string, onIndexChange: (i: number) => void, onClose: () => void }} props
 */
export default function ImageLightbox({ images, index, name, onIndexChange, onClose }) {
    const dialogRef = useRef(null);
    const closeRef = useRef(null);
    const count = images.length;

    useEffect(() => {
        const previous = document.activeElement;
        const { overflow } = document.body.style;
        document.body.style.overflow = "hidden";
        closeRef.current?.focus();
        return () => {
            document.body.style.overflow = overflow;
            if (previous instanceof HTMLElement) previous.focus();
        };
    }, []);

    const go = (delta) => onIndexChange((index + delta + count) % count);

    const trapTab = (event) => {
        const nodes = [...(dialogRef.current?.querySelectorAll(FOCUSABLE) || [])];
        if (nodes.length === 0) return;
        const firstNode = nodes[0];
        const lastNode = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === firstNode) {
            event.preventDefault();
            lastNode.focus();
        } else if (!event.shiftKey && document.activeElement === lastNode) {
            event.preventDefault();
            firstNode.focus();
        }
    };

    const onKeyDown = (event) => {
        // React events bubble through portals; keep the gallery's own arrow keys out of it.
        event.stopPropagation();
        if (event.key === "Escape") {
            event.preventDefault();
            onClose();
        } else if (event.key === "ArrowRight" && count > 1) {
            event.preventDefault();
            go(1);
        } else if (event.key === "ArrowLeft" && count > 1) {
            event.preventDefault();
            go(-1);
        } else if (event.key === "Tab") {
            trapTab(event);
        }
    };

    return createPortal(
        <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${name} images`}
            style={overlayStyle}
            onKeyDown={onKeyDown}
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <span style={counterStyle} aria-live="polite">{index + 1} / {count}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={images[index]}
                alt={`${name} — image ${index + 1} of ${count}`}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 10 }}
            />
            <button ref={closeRef} type="button" aria-label="Close" onClick={onClose} style={{ ...roundBtn, top: 12, right: 16 }}>
                <i className="fa-solid fa-xmark"></i>
            </button>
            {count > 1 && (
                <>
                    <button type="button" aria-label="Previous image" onClick={() => go(-1)} style={{ ...roundBtn, left: 12, top: "50%", transform: "translateY(-50%)" }}>
                        <i className="fa-solid fa-chevron-left"></i>
                    </button>
                    <button type="button" aria-label="Next image" onClick={() => go(1)} style={{ ...roundBtn, right: 12, top: "50%", transform: "translateY(-50%)" }}>
                        <i className="fa-solid fa-chevron-right"></i>
                    </button>
                </>
            )}
        </div>,
        document.body
    );
}
