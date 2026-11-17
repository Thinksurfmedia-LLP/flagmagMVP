"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { stockState } from "@/lib/store/pricing";
import { colorImageFor, sizeLabel } from "@/lib/store/badges";
import { optionsOf, findVariant, shipCopy, MAX_QTY } from "@/lib/store/productSelection";
import SizeGuideModal from "@/components/store/SizeGuideModal";

const UNAVAILABLE_STYLE = { opacity: 0.4 };
// Bootstrap paints disabled buttons with its own blue; keep the theme red at Bootstrap's disabled opacity.
const DISABLED_PRIMARY = {
    "--bs-btn-disabled-bg": "#FF1E00",
    "--bs-btn-disabled-border-color": "#FF1E00",
    "--bs-btn-disabled-color": "#fff",
};

const inStock = (variant) => Boolean(variant) && variant.stock > 0;

function stockLineFor(variant, isAllOut) {
    if (isAllOut) return "Out of stock";
    if (!variant) return "";
    if (variant.stock === 0) return "Out of stock";
    return stockState([variant]).state === "low" ? `Only ${variant.stock} left` : "In stock";
}

/**
 * Colour photos, sizes (+ Size & Fit Guide), quantity, Ship / Pick Up and Add to Bag.
 * @param {{
 *   product: { variants: object[], images: string[], colorImages: object[] },
 *   initial: { color: string, size: string, qty: number },
 *   sizeGuide: { text: string, image: string },
 *   onChange?: (sel: { variant: object|null, qty: number, fulfilment: "ship"|"pick", color: string, size: string }) => void
 * }} props
 */
export default function ProductOptions({ product, initial, sizeGuide, onChange }) {
    const variants = useMemo(() => product.variants || [], [product.variants]);
    const { colors, sizes } = useMemo(() => optionsOf(variants), [variants]);

    const [selection, setSelection] = useState({ color: initial.color, size: initial.size });
    const [rawQty, setRawQty] = useState(initial.qty);
    const [fulfilment, setFulfilment] = useState("ship");
    const [isGuideOpen, setIsGuideOpen] = useState(false);

    const isSizeChosen = sizes.length === 0 || selection.size !== "";
    const variant = isSizeChosen ? findVariant(variants, selection.color, selection.size) : null;
    const isAllOut = !variants.some(inStock);
    const isQtyDisabled = isAllOut || (variant !== null && variant.stock === 0);
    const maxQty = variant ? Math.max(1, Math.min(variant.stock, MAX_QTY)) : MAX_QTY;
    const qty = Math.min(Math.max(rawQty, 1), maxQty);
    const copy = shipCopy(isSizeChosen);
    const stockLine = stockLineFor(variant, isAllOut);
    const variantId = variant?._id;

    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    });
    useEffect(() => {
        onChangeRef.current?.({ variant, qty, fulfilment, color: selection.color, size: selection.size });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variantId, qty, fulfilment, selection.color, selection.size]);

    const sizeAvailable = (size, color) => inStock(findVariant(variants, color, size));
    const colorAvailable = (color) => variants.some((v) => v.color === color && inStock(v));

    const chooseColor = (color) => {
        const size = sizeAvailable(selection.size, color) ? selection.size : "";
        setSelection({ color, size: sizes.length ? size : "" });
    };

    const parseQty = (text) => {
        const n = parseInt(text.replace(/\D/g, ""), 10);
        setRawQty(Number.isNaN(n) ? 1 : n);
    };
    const step = (delta) => {
        if (!isQtyDisabled) setRawQty(qty + delta);
    };
    const stepKey = (delta) => (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            step(delta);
        }
    };

    return (
        <>
            {colors.length > 0 && (
                <div className="product-image-variant">
                    <h4>{selection.color}{variant?.sku ? ` - ${variant.sku}` : ""}</h4>
                    <div className="form-group" role="radiogroup" aria-label="Colour" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {colors.map((color, index) => (
                            <div className="form-check" key={color}>
                                <input type="radio" name="image-variant" id={`img-${index}`}
                                    checked={selection.color === color} disabled={!colorAvailable(color)}
                                    onChange={() => chooseColor(color)} />
                                <label htmlFor={`img-${index}`} title={color} style={colorAvailable(color) ? undefined : UNAVAILABLE_STYLE}>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={colorImageFor(product, color) || "/assets/images/product1.jpg"} alt={color} />
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {sizes.length > 0 && (
                <div className="size-wrap">
                    <div className="size-row">
                        <h4>Size</h4>
                        <h4><a href="#" onClick={(e) => { e.preventDefault(); setIsGuideOpen(true); }}>Size &amp; Fit Guide</a></h4>
                    </div>
                    <div className="form-group" role="radiogroup" aria-label="Size">
                        {sizes.map((size, index) => {
                            const isAvailable = sizeAvailable(size, selection.color);
                            return (
                                <div className="form-check" key={size}>
                                    <input type="radio" name="size-variant" id={`size-${index}`}
                                        checked={selection.size === size} disabled={!isAvailable}
                                        onChange={() => setSelection({ ...selection, size })} />
                                    <label htmlFor={`size-${index}`} style={isAvailable ? undefined : UNAVAILABLE_STYLE}>{sizeLabel(size)}</label>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <p className={stockLine ? "mt-3 mb-0" : "m-0"} aria-live="polite">{stockLine}</p>

            <div className="quantity-wrap">
                <h4>Quantity</h4>
                <div className="number-spinner qty">
                    <span className="ns-btn">
                        <a role="button" tabIndex={isQtyDisabled ? -1 : 0} aria-label="Decrease quantity" aria-disabled={isQtyDisabled || qty <= 1}
                            data-dir="dwn" onClick={() => step(-1)} onKeyDown={stepKey(-1)}>
                            <i className="fa-solid fa-minus"></i>
                        </a>
                    </span>
                    <input type="text" inputMode="numeric" className="pl-ns-value" value={qty} maxLength={2}
                        disabled={isQtyDisabled} aria-label="Quantity" onChange={(e) => parseQty(e.target.value)} />
                    <span className="ns-btn">
                        <a role="button" tabIndex={isQtyDisabled ? -1 : 0} aria-label="Increase quantity" aria-disabled={isQtyDisabled || qty >= maxQty}
                            data-dir="up" onClick={() => step(1)} onKeyDown={stepKey(1)}>
                            <i className="fa-solid fa-plus"></i>
                        </a>
                    </span>
                </div>
            </div>

            <div className="ship-type" role="radiogroup" aria-label="Delivery">
                <div className="form-check">
                    <input type="radio" name="ship-type" id="st1" checked={fulfilment === "ship"} onChange={() => setFulfilment("ship")} />
                    <label htmlFor="st1" className="ship">
                        <h6>Ship</h6>
                        <p>{copy.ship}</p>
                    </label>
                </div>
                <div className="form-check">
                    <input type="radio" name="ship-type" id="st2" checked={fulfilment === "pick"} onChange={() => setFulfilment("pick")} />
                    <label htmlFor="st2" className="pick">
                        <h6>Pick Up</h6>
                        <p>{copy.pick}</p>
                    </label>
                </div>
            </div>

            <button type="button" className="btn btn-primary w-100" disabled style={DISABLED_PRIMARY}>Add to Bag</button>
            <p className="mt-2 mb-0 text-center" style={{ fontSize: 14 }}>Checkout opens soon</p>

            {isGuideOpen && (
                <SizeGuideModal text={sizeGuide.text} image={sizeGuide.image} onClose={() => setIsGuideOpen(false)} />
            )}
        </>
    );
}
