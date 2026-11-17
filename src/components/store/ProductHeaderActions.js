"use client";

import { useEffect, useState } from "react";
import WishlistHeart from "@/components/store/WishlistHeart";

const STATUS_MS = 2500;
const toastStyle = {
    position: "fixed",
    left: "50%",
    bottom: 30,
    transform: "translateX(-50%)",
    zIndex: 100000,
    background: "#1f2022",
    color: "#fff",
    border: "1px solid #4f4f51",
    borderRadius: 36,
    padding: "10px 22px",
    fontSize: 14,
    textTransform: "none",
};

async function shareOrCopy(title, url) {
    if (typeof navigator.share === "function") {
        try {
            await navigator.share({ title, url });
            return "";
        } catch (error) {
            if (error?.name === "AbortError") return "";
        }
    }
    try {
        await navigator.clipboard.writeText(url);
        return "Link copied";
    } catch {
        return "Couldn't copy the link";
    }
}

/**
 * The template's `ul.social`: share (paper plane) + wishlist heart.
 * @param {{ slug: string, name: string, size?: string, color?: string }} props
 */
export default function ProductHeaderActions({ slug, name, size = "", color = "" }) {
    const [status, setStatus] = useState("");

    useEffect(() => {
        if (!status) return undefined;
        const timer = setTimeout(() => setStatus(""), STATUS_MS);
        return () => clearTimeout(timer);
    }, [status]);

    const share = async (event) => {
        event.preventDefault();
        setStatus(await shareOrCopy(name, window.location.href.split("?")[0]));
    };

    return (
        <>
            <ul className="social">
                <li>
                    <a href="#" role="button" aria-label="Share this product" onClick={share}>
                        <i className="fa-regular fa-paper-plane"></i>
                    </a>
                </li>
                <WishlistHeart slug={slug} size={size} color={color} />
            </ul>
            <span role="status" aria-live="polite" className={status ? undefined : "visually-hidden"}
                style={status ? toastStyle : undefined}>{status}</span>
        </>
    );
}
