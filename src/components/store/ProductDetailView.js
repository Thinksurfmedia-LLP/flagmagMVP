"use client";

import { useState } from "react";
import ProductGallery from "@/components/store/ProductGallery";
import ProductHeaderActions from "@/components/store/ProductHeaderActions";
import ProductOptions from "@/components/store/ProductOptions";
import { colorImageFor } from "@/lib/store/badges";

/**
 * Gallery column + `.product-details-wrap` of the product page. Owns the colour/size
 * selection that the gallery (colour photo) and the wishlist heart both follow.
 * Server-rendered pieces come in as slots: `tags` (ul.tag), `intro` (New, name,
 * subtitle, price row) and `children` (description + accordion).
 * @param {{
 *   product: { slug: string, name: string, images: string[], colorImages: object[], variants: object[] },
 *   initial: { color: string, size: string, qty: number },
 *   sizeGuide: { text: string, image: string },
 *   tags: import("react").ReactNode, intro: import("react").ReactNode, children: import("react").ReactNode
 * }} props
 */
export default function ProductDetailView({ product, initial, sizeGuide, tags, intro, children }) {
    const [selection, setSelection] = useState({ color: initial.color, size: initial.size });
    const activeImage = selection.color ? colorImageFor(product, selection.color) : undefined;

    const onOptionsChange = ({ color, size }) => {
        if (color !== selection.color || size !== selection.size) setSelection({ color, size });
    };

    return (
        <>
            <div className="col-lg-7">
                <ProductGallery images={product.images} name={product.name} activeImage={activeImage || undefined} />
            </div>
            <div className="col-lg-5">
                <div className="product-details-wrap">
                    <div className="row justify-content-between">
                        <div className="col">{tags}</div>
                        <div className="col-auto">
                            <ProductHeaderActions slug={product.slug} name={product.name} size={selection.size} color={selection.color} />
                        </div>
                    </div>
                    {intro}
                    <ProductOptions product={product} initial={initial} sizeGuide={sizeGuide} onChange={onOptionsChange} />
                    {children}
                </div>
            </div>
        </>
    );
}
