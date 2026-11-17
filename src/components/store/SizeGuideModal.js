"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const EMPTY_TEXT = "Size guide coming soon.";
const TITLE_ID = "size-guide-title";

/**
 * Store-wide "Size & Fit Guide" (StoreSettings text + optional image).
 * Mount only while open; Esc, the close button or the backdrop closes it.
 * @param {{ text: string, image: string, onClose: () => void }} props
 */
export default function SizeGuideModal({ text, image, onClose }) {
    const closeRef = useRef(null);
    const hasContent = Boolean(text || image);

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

    const onKeyDown = (event) => {
        if (event.key === "Escape") {
            event.preventDefault();
            onClose();
        } else if (event.key === "Tab") {
            // Only one focusable control: keep focus on it.
            event.preventDefault();
            closeRef.current?.focus();
        }
    };

    return createPortal(
        <div className="book-demo-overlay" onClick={(e) => e.target === e.currentTarget && onClose()} onKeyDown={onKeyDown}>
            <div className="book-demo-modal" role="dialog" aria-modal="true" aria-labelledby={TITLE_ID} style={{ maxWidth: 640 }}>
                <button ref={closeRef} type="button" className="book-demo-close" onClick={onClose} aria-label="Close">
                    <i className="fa-solid fa-xmark"></i>
                </button>
                <div className="book-demo-header">
                    <h3 id={TITLE_ID}>Size &amp; Fit Guide</h3>
                </div>
                {!hasContent && <p style={{ color: "#fff", margin: 0 }}>{EMPTY_TEXT}</p>}
                {text && <p style={{ color: "#fff", whiteSpace: "pre-line", fontSize: 15 }}>{text}</p>}
                {image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={image} alt="Size chart" style={{ width: "100%", borderRadius: 10, display: "block" }} />
                )}
            </div>
        </div>,
        document.body
    );
}
