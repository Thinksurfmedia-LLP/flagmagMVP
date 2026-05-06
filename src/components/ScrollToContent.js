"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function ScrollToContent() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        // Small delay to ensure content is rendered
        const timer = setTimeout(() => {
            const mainContent = document.getElementById("main-content");
            if (mainContent) {
                mainContent.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }, 100);

        return () => clearTimeout(timer);
    }, [pathname, searchParams]);

    return null;
}
