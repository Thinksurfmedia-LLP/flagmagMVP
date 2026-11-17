"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPrice, discountPercent, stockState } from "@/lib/store/pricing";

const FALLBACK_IMAGE = "/assets/images/product1.jpg";

/** @param {{ product: object }} props serialized product */
export default function ProductCard({ product }) {
    const [wrapHeight, setWrapHeight] = useState(0);
    const href = `/store/${product.slug}`;
    const percent = discountPercent(product.price, product.compareAtPrice);
    const isOut = stockState(product.variants || []).state === "out";

    // Same reveal the template's jQuery did: grow the button wrap, pull content up.
    const reveal = (el) => setWrapHeight(el.querySelector(".buttom-wrap")?.scrollHeight || 0);
    const hide = () => setWrapHeight(0);

    return (
        <div className="product-card" onMouseEnter={(e) => reveal(e.currentTarget)} onMouseLeave={hide}>
            <div className="product-image-area" style={{ position: "relative" }}>
                <Link href={href}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={product.images?.[0] || FALLBACK_IMAGE} alt={product.name} />
                </Link>
                {isOut && (
                    <span className="badge text-bg-dark" style={{ position: "absolute", top: 10, left: 10 }}>Out of stock</span>
                )}
            </div>
            <div className="product-content-area" style={{ marginTop: wrapHeight ? `-${wrapHeight}px` : 0 }}>
                <h5><Link href={href} style={{ color: "inherit", textDecoration: "none" }}>{product.name}</Link></h5>
                {product.shortDescription && <p>{product.shortDescription}</p>}
                <div className="price">
                    <span>{formatPrice(product.price)}</span>
                    {percent !== null && (
                        <>
                            <bdi><s>{formatPrice(product.compareAtPrice)}</s></bdi>
                            <bdo>({percent}% OFF)</bdo>
                        </>
                    )}
                </div>
            </div>
            <div className="buttom-wrap" style={{ maxHeight: wrapHeight ? `${wrapHeight}px` : 0 }}>
                <Link href={href} className="btn btn-primary">View options</Link>
            </div>
        </div>
    );
}
