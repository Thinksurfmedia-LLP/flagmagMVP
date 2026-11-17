"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/store/pricing";
import { sizeLabel, colorImageFor, cardSubtitle } from "@/lib/store/badges";
import { removeItem, chunk, pruneMissing, readWishlist, writeWishlist, CHANGE_EVENT } from "@/lib/store/wishlist";

const IMAGE_STYLE = { display: "block", width: "100%", aspectRatio: "9 / 10", objectFit: "cover" };
const FALLBACK_IMAGE = "/assets/images/product1.jpg";

function bagHref(item) {
    const params = new URLSearchParams();
    if (item.size) params.set("size", item.size);
    if (item.color) params.set("color", item.color);
    const qs = params.toString();
    return `/store/${item.slug}${qs ? `?${qs}` : ""}`;
}

function WishlistItem({ item, product }) {
    const image = (item.color ? colorImageFor(product, item.color) : product.images?.[0]) || FALLBACK_IMAGE;
    return (
        <div className="col-md-6 col-lg-4">
            <div className="wishlist-item" style={{ position: "relative" }}>
                <button
                    type="button"
                    aria-label={`Remove ${product.name} from wishlist`}
                    onClick={() => writeWishlist(removeItem(readWishlist(), item.slug, item.size, item.color))}
                    style={{ position: "absolute", top: 10, right: 10, zIndex: 2, border: 0, background: "#fff", borderRadius: "50%", width: 36, height: 36, color: "#d62828" }}
                >
                    <i className="fa-solid fa-heart"></i>
                </button>
                <div className="image-area">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt={product.name} style={IMAGE_STYLE} />
                </div>
                <div className="content-area">
                    <h4>{product.name}</h4>
                    <p>{cardSubtitle(product) || " "}</p>
                    {item.size && <p>Size: <span>{sizeLabel(item.size)}</span></p>}
                    <h6>{formatPrice(product.price)}</h6>
                </div>
                <Link href={bagHref(item)} className="btn btn-primary">add to bag</Link>
            </div>
        </div>
    );
}

export default function WishlistGrid() {
    const [items, setItems] = useState(null);
    const [products, setProducts] = useState({});

    useEffect(() => {
        const sync = () => setItems(readWishlist());
        sync();
        window.addEventListener(CHANGE_EVENT, sync);
        return () => window.removeEventListener(CHANGE_EVENT, sync);
    }, []);

    const slugKey = items ? [...new Set(items.map((i) => i.slug))].sort().join(",") : null;

    useEffect(() => {
        if (!slugKey) return undefined;
        const controller = new AbortController();
        const fetchChunk = async (slugs) => {
            try {
                const res = await fetch(`/api/store/products?slugs=${encodeURIComponent(slugs.join(","))}`, { signal: controller.signal });
                const body = await res.json();
                if (!res.ok || !body.success || !Array.isArray(body.data)) return null;
                return { slugs, products: body.data };
            } catch {
                return null; // Offline or aborted: leave these slugs untouched.
            }
        };
        (async () => {
            const results = (await Promise.all(chunk(slugKey.split(",")).map(fetchChunk))).filter(Boolean);
            if (controller.signal.aborted || results.length === 0) return;
            const returned = results.flatMap((r) => r.products);
            setProducts((prev) => ({ ...prev, ...Object.fromEntries(returned.map((p) => [p.slug, p])) }));
            const current = readWishlist();
            const kept = pruneMissing(current, results.flatMap((r) => r.slugs), returned.map((p) => p.slug));
            if (kept.length !== current.length) writeWishlist(kept);
        })();
        return () => controller.abort();
    }, [slugKey]);

    if (items === null) return null;
    if (items.length === 0) {
        return (
            <div className="text-center py-5">
                <h4>Your wishlist is empty.</h4>
                <Link href="/store" className="btn btn-primary mt-3">Browse the store</Link>
            </div>
        );
    }
    const visible = items.filter((i) => products[i.slug]);
    return (
        <div className="row g-4">
            {visible.map((item) => (
                <WishlistItem key={`${item.slug}|${item.size}|${item.color}`} item={item} product={products[item.slug]} />
            ))}
        </div>
    );
}
