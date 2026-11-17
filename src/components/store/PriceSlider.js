"use client";

import { parsePriceText } from "@/lib/store/priceFilter";

const pct = (value, max) => (max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0);

/**
 * Template dual-handle slider (0..maxPrice). Reads the same typed texts as the number boxes and
 * reports changes through onChange(which, text), so it shares the parent's debounce and go() path.
 */
export default function PriceSlider({ minText, maxText, maxPrice, onChange }) {
    const min = Math.min(parsePriceText(minText) ?? 0, maxPrice);
    const max = Math.min(parsePriceText(maxText) ?? maxPrice, maxPrice);
    const low = Math.min(min, max);
    const high = Math.max(min, max);

    return (
        <>
            <div className="slider">
                <div className="progress" style={{ left: `${pct(low, maxPrice)}%`, right: `${100 - pct(high, maxPrice)}%` }}></div>
            </div>
            <div className="range-input">
                <input
                    type="range"
                    className="range-min"
                    min="0"
                    max={maxPrice}
                    step="1"
                    value={low}
                    aria-label="Minimum price slider"
                    onChange={(e) => onChange("min", String(Math.min(Number(e.target.value), high)))}
                />
                <input
                    type="range"
                    className="range-max"
                    min="0"
                    max={maxPrice}
                    step="1"
                    value={high}
                    aria-label="Maximum price slider"
                    onChange={(e) => onChange("max", String(Math.max(Number(e.target.value), low)))}
                />
            </div>
        </>
    );
}
