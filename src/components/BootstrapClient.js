"use client";

import { useEffect } from "react";

export default function BootstrapClient() {
  useEffect(() => {
    // Import jQuery and attach to window
    import("jquery").then((jQueryModule) => {
      const $ = jQueryModule.default;
      window.jQuery = $;
      window.$ = $;

      // Polyfill jQuery utilities removed in v4 (needed by Owl Carousel)
      if (!$.camelCase) {
        $.camelCase = function (str) {
          return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
        };
      }
      if (!$.type) {
        $.type = function (obj) {
          if (obj == null) return obj + "";
          const classToType = {};
          "Boolean Number String Function Array Date RegExp Object Error Symbol"
            .split(" ")
            .forEach((name) => { classToType["[object " + name + "]"] = name.toLowerCase(); });
          return typeof obj === "object" || typeof obj === "function"
            ? classToType[Object.prototype.toString.call(obj)] || "object"
            : typeof obj;
        };
      }
      if (!$.isFunction) {
        $.isFunction = function (obj) { return typeof obj === "function"; };
      }
      if (!$.isNumeric) {
        $.isNumeric = function (obj) { return !isNaN(parseFloat(obj)) && isFinite(obj); };
      }
      if (!$.isArray) {
        $.isArray = Array.isArray;
      }
      if (!$.isWindow) {
        $.isWindow = function (obj) { return obj != null && obj === obj.window; };
      }

      // Import Bootstrap JS
      import("bootstrap/dist/js/bootstrap.bundle.min.js").then(() => {
        // Import Owl Carousel (requires jQuery on window)
        import("owl.carousel").then(() => {
          // Initialize testimonial carousel
          $(".testimonial-carousel").owlCarousel({
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

          // Initialize gallery carousel
          $(".gallery-carousel").owlCarousel({
            loop: true,
            margin: 10,
            nav: true,
            autoplay: true,
            autoplayTimeout: 3000,
            responsive: {
              0: { items: 2, nav: false },
              600: { items: 2, nav: true },
              1000: { items: 3 },
              1200: { items: 4 },
              1400: { items: 5 },
            },
          });
        });
      });

      // Import AOS
      import("aos").then((AOS) => {
        AOS.init();
      });
    });

    // Smooth scroll rotation animation for .build-bg img
    let currentRotation = 0;
    let targetRotation = 0;
    const ease = 0.08;

    const handleScroll = () => {
      targetRotation = window.scrollY * 0.3;
    };
    window.addEventListener("scroll", handleScroll);

    let animationId;
    function animate() {
      currentRotation += (targetRotation - currentRotation) * ease;
      const el = document.querySelector(".build-bg img");
      if (el) {
        el.style.transform = "rotate(" + currentRotation + "deg)";
      }
      animationId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return null;
}
