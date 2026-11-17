import Link from "next/link";
import { toQueryString } from "@/lib/store/catalogQuery";

function pageHref(query, page) {
    const qs = toQueryString(query, { page });
    return qs ? `/store?${qs}` : "/store";
}

/** Template pagination. Hidden when there is only one page. */
export default function StorePagination({ query, page, pageCount }) {
    if (pageCount <= 1) return null;
    const pages = Array.from({ length: pageCount }, (_, i) => i + 1);
    const prevDisabled = page <= 1;
    const nextDisabled = page >= pageCount;

    return (
        <nav className="navigation" aria-label="Store pages">
            <ul className="pagination">
                <li className={`page-item${prevDisabled ? " disabled" : ""}`}>
                    {prevDisabled ? (
                        <span className="page-link" aria-disabled="true"><i className="fa-solid fa-angles-left"></i></span>
                    ) : (
                        <Link className="page-link" href={pageHref(query, page - 1)} aria-label="Previous page">
                            <i className="fa-solid fa-angles-left"></i>
                        </Link>
                    )}
                </li>
                {pages.map((p) => (
                    <li key={p} className={`page-item${p === page ? " active" : ""}`}>
                        <Link className="page-link" href={pageHref(query, p)} aria-current={p === page ? "page" : undefined}>{p}</Link>
                    </li>
                ))}
                <li className={`page-item${nextDisabled ? " disabled" : ""}`}>
                    {nextDisabled ? (
                        <span className="page-link" aria-disabled="true"><i className="fa-solid fa-angles-right"></i></span>
                    ) : (
                        <Link className="page-link" href={pageHref(query, page + 1)} aria-label="Next page">
                            <i className="fa-solid fa-angles-right"></i>
                        </Link>
                    )}
                </li>
            </ul>
        </nav>
    );
}
