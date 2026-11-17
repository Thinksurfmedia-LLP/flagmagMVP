"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toQueryString } from "@/lib/store/catalogQuery";
import { mergePendingPrice } from "@/lib/store/priceFilter";
import { toggleValue, recordPush, reconcileUrl } from "@/lib/store/filterSync";

const PRICE_DEBOUNCE_MS = 400;
const SORT_OPTIONS = [
    ["newest", "Newest"],
    ["price-asc", "Price: low to high"],
    ["price-desc", "Price: high to low"],
    ["name", "Name"],
];

const priceText = (n) => (n === null || n === undefined ? "" : String(n));

/**
 * @param {{ query: object, categories: object[], facets: { colors: {name:string,hex:string}[], sizes: string[], maxPrice: number } }} props
 */
export default function StoreFilters({ query, categories, facets }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [minText, setMinText] = useState(priceText(query.minPrice));
    const [maxText, setMaxText] = useState(priceText(query.maxPrice));
    const timer = useRef(null);
    // Working query: what the user has chosen so far, ahead of the server render. Toggles
    // compute from queryRef so a fast second click builds on the first instead of the stale prop.
    const [working, setWorking] = useState(query);
    const queryRef = useRef(query);
    const inFlightRef = useRef([]);
    const urlQs = toQueryString(query, { page: query.page });
    const urlQsRef = useRef(urlQs);
    const textsRef = useRef({ min: priceText(query.minPrice), max: priceText(query.maxPrice) });
    // Price values this component last pushed to the URL; a URL change to these is ours, not back/forward.
    const [pushed, setPushed] = useState({ min: query.minPrice, max: query.maxPrice });
    const [seen, setSeen] = useState({ min: query.minPrice, max: query.maxPrice });

    useEffect(() => {
        textsRef.current = { min: minText, max: maxText };
    });

    // The URL moved. Adopt it unless it is an intermediate state of pushes we still have pending.
    useEffect(() => {
        urlQsRef.current = urlQs;
        const result = reconcileUrl(inFlightRef.current, urlQs);
        inFlightRef.current = result.inFlight;
        if (result.adopt) {
            queryRef.current = query;
            setWorking(query);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- react only to URL changes
    }, [urlQs]);

    // Re-sync typed values only when the URL moved to something we did not push (back/forward, Clear filters).
    if (seen.min !== query.minPrice || seen.max !== query.maxPrice) {
        setSeen({ min: query.minPrice, max: query.maxPrice });
        if (seen.min !== query.minPrice && query.minPrice !== pushed.min) {
            setMinText(priceText(query.minPrice));
            setPushed((p) => ({ ...p, min: query.minPrice }));
        }
        if (seen.max !== query.maxPrice && query.maxPrice !== pushed.max) {
            setMaxText(priceText(query.maxPrice));
            setPushed((p) => ({ ...p, max: query.maxPrice }));
        }
    }

    useEffect(() => () => clearTimeout(timer.current), []);

    // Every navigation folds in any pending price text and cancels the debounce, so nothing is dropped.
    const go = (change = {}) => {
        clearTimeout(timer.current);
        const next = mergePendingPrice(queryRef.current, textsRef.current);
        const qs = toQueryString(next, change);
        inFlightRef.current = recordPush(inFlightRef.current, qs, urlQsRef.current);
        const updated = { ...next, ...change, page: "page" in change ? change.page : 1 };
        queryRef.current = updated;
        setWorking(updated);
        setPushed({ min: next.minPrice, max: next.maxPrice });
        router.push(qs ? `/store?${qs}` : "/store", { scroll: false });
    };

    const onPrice = (which, text) => {
        (which === "min" ? setMinText : setMaxText)(text);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => go(), PRICE_DEBOUNCE_MS);
    };

    // Public list hides empty categories, but keeps a selected one so it can be unticked.
    const visibleCategories = categories.filter((c) => c.activeCount > 0 || c.slug === working.category);

    return (
        <>
            <button
                type="button"
                className="btn btn-primary d-lg-none w-100 mb-3"
                aria-expanded={open}
                aria-controls="store-filters"
                onClick={() => setOpen((v) => !v)}
            >
                {open ? "Hide filters" : "Filters"}
            </button>
            <div
                id="store-filters"
                className={`col-12 col-lg-auto store-filter-area${open ? "" : " d-none d-lg-block"}`}
                style={{ maxWidth: "100%" }}
            >
                <h4>Filters</h4>

                <div className="filter-wrap">
                    <h5>sort</h5>
                    <select
                        className="form-select"
                        aria-label="Sort products"
                        value={working.sort}
                        onChange={(e) => go({ sort: e.target.value })}
                    >
                        {SORT_OPTIONS.map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </div>

                {visibleCategories.length > 0 && (
                    <div className="filter-wrap">
                        <h5>categories</h5>
                        {visibleCategories.map((c) => (
                            <div className="form-check" key={c.slug}>
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id={`cat-${c.slug}`}
                                    checked={working.category === c.slug}
                                    onChange={() => go({ category: queryRef.current.category === c.slug ? null : c.slug })}
                                />
                                <label className="form-check-label" htmlFor={`cat-${c.slug}`}>
                                    {c.name} <span>({c.activeCount})</span>
                                </label>
                            </div>
                        ))}
                    </div>
                )}

                <div className="filter-wrap">
                    <h5>price</h5>
                    <div className="price-filter">
                        <div className="price-input">
                            <div className="field">
                                <span>$</span>
                                <input
                                    type="number"
                                    className="input-min"
                                    min="0"
                                    max={facets.maxPrice}
                                    placeholder="0"
                                    aria-label="Minimum price"
                                    value={minText}
                                    onChange={(e) => onPrice("min", e.target.value)}
                                />
                            </div>
                            <div className="separator">-</div>
                            <div className="field">
                                <span>$</span>
                                <input
                                    type="number"
                                    className="input-max"
                                    min="0"
                                    max={facets.maxPrice}
                                    placeholder={String(facets.maxPrice)}
                                    aria-label="Maximum price"
                                    value={maxText}
                                    onChange={(e) => onPrice("max", e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {facets.colors.length > 0 && (
                    <div className="filter-wrap color-filter">
                        <h5>Color</h5>
                        {facets.colors.map((c, i) => (
                            <div className="form-check" key={c.name}>
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id={`color-${i}`}
                                    checked={working.colors.includes(c.name)}
                                    onChange={() => go({ colors: toggleValue(queryRef.current.colors, c.name) })}
                                />
                                <label className="form-check-label" htmlFor={`color-${i}`}>
                                    <span style={{ background: c.hex || "#888" }}></span> {c.name}
                                </label>
                            </div>
                        ))}
                    </div>
                )}

                {facets.sizes.length > 0 && (
                    <div className="filter-wrap">
                        <h5>Size</h5>
                        {facets.sizes.map((s, i) => (
                            <div className="form-check" key={s}>
                                <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id={`size-${i}`}
                                    checked={working.sizes.includes(s)}
                                    onChange={() => go({ sizes: toggleValue(queryRef.current.sizes, s) })}
                                />
                                <label className="form-check-label" htmlFor={`size-${i}`}>{s}</label>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
