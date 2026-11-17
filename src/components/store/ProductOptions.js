"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { stockState } from "@/lib/store/pricing";
import { sortSizes } from "@/lib/store/catalogQuery";

const MAX_QTY = 99;
const NEUTRAL_SWATCH = "#4a4a4d";
const SWATCH_SIZE = 65;

/** Same box for every swatch; colours without a hex get a neutral grey with the name. */
const swatchStyle = (hex) => ({
    boxSizing: "border-box",
    flex: "none",
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: 0,
    padding: 2,
    background: hex || NEUTRAL_SWATCH,
    color: "#fff",
    fontSize: 11,
    lineHeight: 1.1,
    textAlign: "center",
    overflow: "hidden",
    cursor: "pointer",
});

const unique = (values) => [...new Set(values.filter(Boolean))];
const inStock = (variant) => Boolean(variant) && variant.stock > 0;

/** Default pick: first in-stock variant by colour order, then size order. */
function pickDefault(variants, colors, sizes) {
    for (const color of colors.length ? colors : [""]) {
        for (const size of sizes.length ? sizes : [""]) {
            const match = variants.find((v) => v.color === color && v.size === size);
            if (inStock(match)) return { color, size };
        }
    }
    const first = variants[0];
    return { color: first?.color || "", size: first?.size || "" };
}

/**
 * @param {{ product: { variants: object[] }, onChange?: (sel: { variant: object|null, qty: number }) => void }} props
 */
export default function ProductOptions({ product, onChange }) {
    const variants = useMemo(() => product.variants || [], [product.variants]);
    const colors = useMemo(() => unique(variants.map((v) => v.color)), [variants]);
    const sizes = useMemo(() => sortSizes(unique(variants.map((v) => v.size))), [variants]);

    const [selection, setSelection] = useState(() => pickDefault(variants, colors, sizes));
    const [rawQty, setRawQty] = useState(1);

    const variant = variants.find((v) => v.color === selection.color && v.size === selection.size) || null;
    const stock = variant ? variant.stock : 0;
    const maxQty = Math.max(1, Math.min(stock, MAX_QTY));
    const qty = Math.min(Math.max(rawQty, 1), maxQty);
    const isOut = stock === 0;
    const variantId = variant?._id;

    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    });
    useEffect(() => {
        onChangeRef.current?.({ variant, qty });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variantId, qty]);

    const sizeAvailable = (size, color) => inStock(variants.find((v) => v.color === color && v.size === size));
    const colorAvailable = (color) => variants.some((v) => v.color === color && v.stock > 0);

    const chooseColor = (color) => {
        const keepSize = sizeAvailable(selection.size, color);
        const nextSize = keepSize ? selection.size : sizes.find((s) => sizeAvailable(s, color)) ?? selection.size;
        setSelection({ color, size: nextSize });
    };

    const stockLine = isOut
        ? "Out of stock"
        : stockState([variant]).state === "low"
          ? `Only ${stock} left`
          : "In stock";

    const parseQty = (text) => {
        const n = parseInt(text.replace(/\D/g, ""), 10);
        setRawQty(Number.isNaN(n) ? 1 : n);
    };

    const step = (delta) => {
        if (!isOut) setRawQty(qty + delta);
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
                    <h4>{selection.color}</h4>
                    <div className="form-group" role="radiogroup" aria-label="Color" style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                        {colors.map((color) => {
                            const hex = variants.find((v) => v.color === color)?.colorHex;
                            return (
                                <div className="form-check" key={color}>
                                    <input
                                        type="radio"
                                        name="color-variant"
                                        id={`color-${color}`}
                                        checked={selection.color === color}
                                        disabled={!colorAvailable(color)}
                                        onChange={() => chooseColor(color)}
                                    />
                                    <label
                                        htmlFor={`color-${color}`}
                                        title={color}
                                        aria-label={color}
                                        style={swatchStyle(hex)}
                                    >
                                        {hex ? null : color}
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {sizes.length > 0 && (
                <div className="size-wrap">
                    <div className="size-row">
                        <h4>Size</h4>
                    </div>
                    <div className="form-group" role="radiogroup" aria-label="Size">
                        {sizes.map((size) => (
                            <div className="form-check" key={size}>
                                <input
                                    type="radio"
                                    name="size-variant"
                                    id={`size-${size}`}
                                    checked={selection.size === size}
                                    disabled={!sizeAvailable(size, selection.color)}
                                    onChange={() => setSelection({ ...selection, size })}
                                />
                                <label htmlFor={`size-${size}`}>{size}</label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <p className="mt-3 mb-0" aria-live="polite">{stockLine}</p>

            <div className="quantity-wrap">
                <h4>Quantity</h4>
                <div className="number-spinner qty">
                    <span className="ns-btn">
                        <a role="button" tabIndex={isOut ? -1 : 0} aria-label="Decrease quantity" aria-disabled={isOut || qty <= 1}
                            onClick={() => step(-1)} onKeyDown={stepKey(-1)}>
                            <i className="fa-solid fa-minus"></i>
                        </a>
                    </span>
                    <input type="text" inputMode="numeric" className="pl-ns-value" value={qty} maxLength={2}
                        disabled={isOut} aria-label="Quantity" onChange={(e) => parseQty(e.target.value)} />
                    <span className="ns-btn">
                        <a role="button" tabIndex={isOut ? -1 : 0} aria-label="Increase quantity" aria-disabled={isOut || qty >= maxQty}
                            onClick={() => step(1)} onKeyDown={stepKey(1)}>
                            <i className="fa-solid fa-plus"></i>
                        </a>
                    </span>
                </div>
            </div>

            <div className="mt-4">
                <button
                    type="button"
                    className="btn btn-primary w-100"
                    disabled
                    style={{ backgroundColor: "#FF1E00", borderColor: "#FF1E00", color: "#fff", opacity: 0.5, cursor: "not-allowed" }}
                >
                    Add to Bag
                </button>
                <p className="mt-2 mb-0 text-center" style={{ fontSize: 14 }}>Checkout opens soon</p>
            </div>
        </>
    );
}
