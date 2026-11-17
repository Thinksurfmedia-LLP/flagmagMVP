import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import CategoryStrip from "@/components/store/CategoryStrip";
import StoreFilters from "@/components/store/StoreFilters";
import ProductCard from "@/components/store/ProductCard";
import StorePagination from "@/components/store/StorePagination";
import { parseCatalogQuery } from "@/lib/store/catalogQuery";
import { listProducts, listCategoriesWithCounts, getFacetOptions, serialize } from "@/lib/store/catalog";

export const metadata = { title: "Store | FlagMag" };
export const dynamic = "force-dynamic";

export default async function StorePage({ searchParams }) {
    const query = parseCatalogQuery(await searchParams);
    const [result, categories, facets] = await Promise.all([
        listProducts(query),
        listCategoriesWithCounts(),
        getFacetOptions(),
    ]);
    const products = serialize(result.items);
    const plainCategories = serialize(categories);

    return (
        <>
            <Header />

            <section className="innerpage-section">
                <div className="banner-area"><img src="/assets/images/store-banner1.jpg" alt="" /></div>
                <div className="container">
                    <div className="breadcrumb-area">
                        <h5>Home // Store</h5>
                        <h1>Our store</h1>
                    </div>
                </div>
            </section>

            <CategoryStrip categories={plainCategories} />

            <section className="store-list-section section-padding">
                <div className="container">
                    <div className="row align-items-start">
                        <StoreFilters query={query} categories={plainCategories} facets={serialize(facets)} />

                        <div className="col">
                            {products.length > 0 ? (
                                <>
                                    <div className="product-list row g-4">
                                        {products.map((product) => (
                                            <div className="col-md-6 col-xl-4" key={product._id}>
                                                <ProductCard product={product} />
                                            </div>
                                        ))}
                                    </div>
                                    <StorePagination query={query} page={result.page} pageCount={result.pageCount} />
                                </>
                            ) : (
                                <div className="text-center py-5">
                                    <h4>No products match these filters</h4>
                                    <Link href="/store" className="btn btn-primary mt-3">Clear filters</Link>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}
