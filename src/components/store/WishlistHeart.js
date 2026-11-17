"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addItem, removeItem, hasItem, readWishlist, writeWishlist, CHANGE_EVENT } from "@/lib/store/wishlist";

const SAVED_MS = 4000;
const toastStyle = {
    position: "fixed", left: "50%", bottom: 30, transform: "translateX(-50%)", zIndex: 100000,
    background: "#1f2022", color: "#fff", border: "1px solid #4f4f51", borderRadius: 36,
    padding: "10px 22px", fontSize: 14, textTransform: "none", fontWeight: 400,
};

/**
 * Heart toggle for the product page. Renders only the `<li>` so the page can place it
 * inside its `ul.social`.
 * @param {{ slug: string, size?: string, color?: string }} props
 */
export default function WishlistHeart({ slug, size = "", color = "" }) {
    const [isSaved, setIsSaved] = useState(false);
    const [showSaved, setShowSaved] = useState(false);

    useEffect(() => {
        const sync = () => setIsSaved(hasItem(readWishlist(), slug));
        sync();
        window.addEventListener(CHANGE_EVENT, sync);
        window.addEventListener("storage", sync);
        return () => {
            window.removeEventListener(CHANGE_EVENT, sync);
            window.removeEventListener("storage", sync);
        };
    }, [slug]);

    useEffect(() => {
        if (!showSaved) return undefined;
        const timer = setTimeout(() => setShowSaved(false), SAVED_MS);
        return () => clearTimeout(timer);
    }, [showSaved]);

    const toggle = () => {
        const list = readWishlist();
        if (hasItem(list, slug)) {
            setShowSaved(false);
            const cleared = list.filter((i) => i.slug === slug).reduce((acc, i) => removeItem(acc, i.slug, i.size, i.color), list);
            writeWishlist(cleared);
        } else {
            writeWishlist(addItem(list, { slug, size, color }));
            setShowSaved(true);
        }
    };

    const onKeyDown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            toggle();
        }
    };

    return (
        <li>
            <a
                href="#"
                role="button"
                aria-pressed={isSaved}
                aria-label={isSaved ? "Remove from wishlist" : "Add to wishlist"}
                onClick={(e) => { e.preventDefault(); toggle(); }}
                onKeyDown={onKeyDown}
            >
                <i className={`${isSaved ? "fa-solid" : "fa-regular"} fa-heart`}></i>
            </a>
            <span role="status" aria-live="polite" className={showSaved ? undefined : "visually-hidden"}
                style={showSaved ? toastStyle : undefined}>
                {showSaved && (<>Saved to wishlist &middot; <Link href="/wishlist" style={{ color: "#fff", textDecoration: "underline" }}>View</Link></>)}
            </span>
        </li>
    );
}
