"use client";

import { useEffect, useState } from "react";
import { addItem, removeItem, hasItem, readWishlist, writeWishlist, CHANGE_EVENT } from "@/lib/store/wishlist";

/**
 * Heart toggle for the product page. Renders only the `<li>` so the page can place it
 * inside its `ul.social`.
 * @param {{ slug: string, size?: string, color?: string }} props
 */
export default function WishlistHeart({ slug, size = "", color = "" }) {
    const [isSaved, setIsSaved] = useState(false);

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

    const toggle = () => {
        const list = readWishlist();
        if (hasItem(list, slug)) {
            const cleared = list.filter((i) => i.slug === slug).reduce((acc, i) => removeItem(acc, i.slug, i.size, i.color), list);
            writeWishlist(cleared);
        } else {
            writeWishlist(addItem(list, { slug, size, color }));
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
        </li>
    );
}
