"use client";

import { useState } from "react";
import Link from "next/link";
import { cardSubtitle } from "@/lib/store/badges";
import { formatPrice, discountPercent, stockState } from "@/lib/store/pricing";

const FALLBACK_IMAGE = "/assets/images/product1.jpg";
const MAX_QTY = 99;
// Template card photos are 294x320; a fixed box keeps every card in a row the same height.
const IMAGE_STYLE = { display: "block", width: "100%", aspectRatio: "294 / 320", objectFit: "cover" };

const clampQty = (n) => Math.min(MAX_QTY, Math.max(1, n));

/** @param {{ product: object }} props serialized product */
export default function ProductCard({ product }) {
    const [wrapHeight, setWrapHeight] = useState(0);
    const [qty, setQty] = useState(1);
    const href = `/store/${product.slug}`;
    const percent = discountPercent(product.price, product.compareAtPrice);
    const isOut = stockState(product.variants || []).state === "out";

    // Same reveal the template's jQuery did: grow the button wrap, pull content up.
    const reveal = (el) => setWrapHeight(el.querySelector(".buttom-wrap")?.scrollHeight || 0);
    const hide = () => setWrapHeight(0);
    const step = (delta) => setQty((q) => clampQty(q + delta));
    const stepKey = (delta) => (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); step(delta); }
    };
    const onQtyInput = (text) => {
        const digits = text.replace(/\D/g, "");
        if (digits !== "") setQty(clampQty(Number(digits)));
    };

    return (
        <div className="product-card" onMouseEnter={(e) => reveal(e.currentTarget)} onMouseLeave={hide}>
            <div className="product-image-area" style={{ position: "relative" }}>
                <Link href={href}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={product.images?.[0] || FALLBACK_IMAGE} alt={product.name} style={IMAGE_STYLE} />
                </Link>
                {isOut && (
                    <span className="badge text-bg-dark" style={{ position: "absolute", top: 10, left: 10 }}>Out of stock</span>
                )}
            </div>
            <div className="product-content-area" style={{ marginTop: wrapHeight ? `-${wrapHeight}px` : 0 }}>
                <h5><Link href={href} style={{ color: "inherit", textDecoration: "none" }}>{product.name}</Link></h5>
                <p>{cardSubtitle(product) || " "}</p>
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
                <div className="number-spinner qty">
                    <h5>Qty</h5>
                    <span className="ns-btn">
                        <a role="button" tabIndex={0} aria-label="Decrease quantity" data-dir="dwn"
                            onClick={() => step(-1)} onKeyDown={stepKey(-1)}>
                            <i className="fa-solid fa-minus"></i>
                        </a>
                    </span>
                    <input type="text" inputMode="numeric" className="pl-ns-value" value={qty} maxLength={2}
                        aria-label="Quantity" onChange={(e) => onQtyInput(e.target.value)} />
                    <span className="ns-btn">
                        <a role="button" tabIndex={0} aria-label="Increase quantity" data-dir="up"
                            onClick={() => step(1)} onKeyDown={stepKey(1)}>
                            <i className="fa-solid fa-plus"></i>
                        </a>
                    </span>
                </div>
                <Link href={`${href}?qty=${qty}`} className="btn btn-primary">Add to cart</Link>
            </div>
        </div>
    );
}
