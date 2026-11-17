import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductGallery from "@/components/store/ProductGallery";
import ProductOptions from "@/components/store/ProductOptions";
import ProductReviews from "@/components/store/ProductReviews";
import ProductCard from "@/components/store/ProductCard";
import { parseCatalogQuery } from "@/lib/store/catalogQuery";
import { getProductBySlug, listProducts, serialize } from "@/lib/store/catalog";
import { formatPrice, discountPercent } from "@/lib/store/pricing";

export const dynamic = "force-dynamic";

const RELATED_LIMIT = 4;
const SEP = "//";

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const product = await getProductBySlug(slug);
    if (!product) return { title: "Product not found | FlagMag Store" };
    return { title: `${product.name} | FlagMag Store`, description: product.shortDescription || undefined };
}

async function getRelated(product) {
    const slug = product.category?.slug;
    if (!slug) return [];
    const result = await listProducts(parseCatalogQuery({ category: slug }));
    return serialize(result.items.filter((item) => String(item._id) !== String(product._id)).slice(0, RELATED_LIMIT));
}

export default async function ProductPage({ params }) {
    const { slug } = await params;
    const doc = await getProductBySlug(slug);
    if (!doc) notFound();

    const product = serialize(doc);
    const related = await getRelated(doc);
    const percent = discountPercent(product.price, product.compareAtPrice);
    const category = product.category;

    return (
        <>
            <Header />

            <section className="store-details-section section-padding">
                <div className="container">
                    <div className="row">
                        <div className="col-12">
                            <div className="breadcrumb">
                                <Link href="/">Home</Link> <span>{SEP}</span> <Link href="/store">Store</Link>
                                {category && (
                                    <>
                                        {" "}<span>{SEP}</span> <Link href={`/store?category=${category.slug}`}>{category.name}</Link>
                                    </>
                                )}
                                {" "}<span>{SEP}</span> {product.name}
                            </div>
                        </div>
                        <div className="col-lg-7">
                            <ProductGallery images={product.images} name={product.name} />
                        </div>
                        <div className="col-lg-5">
                            <div className="product-details-wrap">
                                {category && (
                                    <ul className="tag">
                                        <li><Link href={`/store?category=${category.slug}`}>{category.name}</Link></li>
                                    </ul>
                                )}
                                <h2>{product.name}</h2>
                                {product.shortDescription && <h4>{product.shortDescription}</h4>}
                                <div className="price">
                                    <h3 style={{ display: "inline-block", marginRight: 10 }}>{formatPrice(product.price)}</h3>
                                    {percent !== null && (
                                        <>
                                            <bdi style={{ marginRight: 8 }}><s>{formatPrice(product.compareAtPrice)}</s></bdi>
                                            <bdo>({percent}% OFF)</bdo>
                                        </>
                                    )}
                                </div>

                                <ProductOptions product={{ variants: product.variants }} />

                                {product.description && (
                                    <div className="description-area">
                                        <p style={{ whiteSpace: "pre-line" }}>{product.description}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <ProductReviews />
                </div>
            </section>

            {related.length > 0 && (
                <section className="related-product-section store-list-section section-padding-bottom">
                    <div className="container">
                        <div className="heading-area text-center"><h2>Related Products</h2></div>
                        <div className="row product-list">
                            {related.map((item) => (
                                <div className="col-md-6 col-lg-4 col-xl-3" key={item._id}>
                                    <ProductCard product={item} />
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <Footer />
        </>
    );
}
