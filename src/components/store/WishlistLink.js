"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readWishlist, CHANGE_EVENT } from "@/lib/store/wishlist";

/** "My Wishlist" button with a count badge once something is saved. */
export default function WishlistLink() {
    const [count, setCount] = useState(0);

    useEffect(() => {
        const sync = () => setCount(readWishlist().length);
        sync();
        window.addEventListener(CHANGE_EVENT, sync);
        window.addEventListener("storage", sync);
        return () => {
            window.removeEventListener(CHANGE_EVENT, sync);
            window.removeEventListener("storage", sync);
        };
    }, []);

    return (
        <Link href="/wishlist" className="btn btn-info-primary">
            My Wishlist
            {count > 0 && (
                <span className="badge rounded-pill ms-2" style={{ background: "#FF1E00", color: "#fff" }}>
                    {count}<span className="visually-hidden"> saved items</span>
                </span>
            )}
        </Link>
    );
}
