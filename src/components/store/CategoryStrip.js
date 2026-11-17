import Link from "next/link";

/** "Shop by Category" tiles. Renders nothing when no category has an image. */
export default function CategoryStrip({ categories }) {
    const tiles = categories.filter((c) => c.image);
    if (tiles.length === 0) return null;

    return (
        <section className="store-banner-section section-padding-top" id="main-content">
            <div className="container">
                <div className="row align-items-center text-center gy-3 justify-content-between mb-4">
                    <div className="col-sm-auto">
                        <h2>Shop by Category</h2>
                    </div>
                    <div className="col-sm-auto">
                        <Link href="/store" className="btn btn-primary">See All</Link>
                    </div>
                </div>
                <div className="row g-3">
                    {tiles.map((c) => (
                        <div className="col-6 col-md-4" key={c.slug}>
                            <Link href={`/store?category=${encodeURIComponent(c.slug)}`} aria-label={c.name}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={c.image} alt={c.name} style={{ width: "100%", borderRadius: 10 }} />
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
