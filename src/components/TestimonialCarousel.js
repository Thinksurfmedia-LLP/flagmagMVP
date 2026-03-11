"use client";

import { useEffect, useRef } from "react";

export default function TestimonialCarousel({ children }) {
    const containerRef = useRef(null);

    useEffect(() => {
        let destroyed = false;
        let $el;

        (async () => {
            // Ensure jQuery is on window
            if (!window.jQuery) {
                const jq = await import("jquery");
                window.jQuery = jq.default;
                window.$ = jq.default;
            }
            const $ = window.jQuery;

            // Polyfills needed by Owl Carousel
            if (!$.camelCase) $.camelCase = (s) => s.replace(/-([a-z])/g, (_, l) => l.toUpperCase());
            if (!$.isFunction) $.isFunction = (o) => typeof o === "function";
            if (!$.isNumeric) $.isNumeric = (o) => !isNaN(parseFloat(o)) && isFinite(o);
            if (!$.isArray) $.isArray = Array.isArray;
            if (!$.isWindow) $.isWindow = (o) => o != null && o === o.window;
            if (!$.type) {
                const m = {};
                "Boolean Number String Function Array Date RegExp Object Error Symbol"
                    .split(" ")
                    .forEach((n) => { m["[object " + n + "]"] = n.toLowerCase(); });
                $.type = (o) =>
                    o == null ? o + "" : typeof o === "object" || typeof o === "function"
                        ? m[Object.prototype.toString.call(o)] || "object"
                        : typeof o;
            }

            await import("owl.carousel");

            if (destroyed || !containerRef.current) return;

            $el = $(containerRef.current);
            $el.owlCarousel({
                loop: true,
                margin: 10,
                nav: true,
                autoplay: true,
                autoplayTimeout: 3000,
                responsive: {
                    0: { items: 1, nav: false },
                    600: { items: 2, nav: true },
                    1000: { items: 3 },
                },
            });
        })();

        return () => {
            destroyed = true;
            if ($el && $el.data("owl.carousel")) {
                $el.owlCarousel("destroy");
            }
        };
    }, []);

    return (
        <div ref={containerRef} className="owl-carousel owl-theme testimonial-carousel">
            {children}
        </div>
    );
}
