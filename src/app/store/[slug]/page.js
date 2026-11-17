import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductDetailView from "@/components/store/ProductDetailView";
import ProductAccordion from "@/components/store/ProductAccordion";
import ProductReviews from "@/components/store/ProductReviews";
import ProductCard from "@/components/store/ProductCard";
import { parseCatalogQuery } from "@/lib/store/catalogQuery";
import { getProductBySlug, listProducts, serialize } from "@/lib/store/catalog";
import { getStoreSettings } from "@/lib/store/settings";
import { formatPrice, discountPercent } from "@/lib/store/pricing";
import { isNewProduct } from "@/lib/store/badges";
import { initialSelection } from "@/lib/store/productSelection";

export const dynamic = "force-dynamic";

const RELATED_LIMIT = 4;
const SEP = "//";
const STAR_COUNT = 5;

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

function TagList({ category, tags }) {
    const list = Array.isArray(tags) ? tags.filter((t) => typeof t === "string" && t) : [];
    if (!category && list.length === 0) return null;
    return (
        <ul className="tag">
            {category && <li><Link href={`/store?category=${encodeURIComponent(category.slug)}`}>{category.name}</Link></li>}
            {list.map((tag) => (
                <li key={tag}><Link href={`/store?q=${encodeURIComponent(tag)}`}>{tag}</Link></li>
            ))}
        </ul>
    );
}

function ProductIntro({ product }) {
    const percent = discountPercent(product.price, product.compareAtPrice);
    const subtitle = product.subtitle || product.shortDescription;
    return (
        <>
            {isNewProduct(product) && (
                // eslint-disable-next-line @next/next/no-img-element
                <h6><img src="/assets/images/icon-hot.png" alt="" /> New</h6>
            )}
            <h2>{product.name}</h2>
            {subtitle && <h4>{subtitle}</h4>}
            <div className="row justify-content-between align-items-center">
                <div className="col-auto">
                    <h3 style={{ display: "inline-block", marginRight: 10 }}>{formatPrice(product.price)}</h3>
                    {percent !== null && (
                        <span className="price">
                            <bdi style={{ marginRight: 8 }}><s>{formatPrice(product.compareAtPrice)}</s></bdi>
                            <bdo>({percent}% OFF)</bdo>
                        </span>
                    )}
                </div>
                <div className="col-auto">
                    {/* Static until reviews exist (spec), matching the reviews block. */}
                    <ul className="star-rating" aria-label="Rating">
                        {Array.from({ length: STAR_COUNT }, (_, i) => (
                            <li key={i}><i className="fa-solid fa-star"></i></li>
                        ))}
                    </ul>
                </div>
            </div>
        </>
    );
}

export default async function ProductPage({ params, searchParams }) {
    const { slug } = await params;
    const doc = await getProductBySlug(slug);
    if (!doc) notFound();

    const [related, settings, query] = await Promise.all([getRelated(doc), getStoreSettings(), searchParams]);
    const product = serialize(doc);
    const category = product.category;
    const initial = initialSelection(product.variants, query || {});
    const viewProduct = {
        slug: product.slug,
        name: product.name,
        images: product.images || [],
        colorImages: Array.isArray(product.colorImages) ? product.colorImages : [],
        variants: product.variants || [],
    };

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
                        <ProductDetailView
                            product={viewProduct}
                            initial={initial}
                            sizeGuide={{ text: settings.sizeGuideText, image: settings.sizeGuideImage }}
                            tags={<TagList category={category} tags={product.tags} />}
                            intro={<ProductIntro product={product} />}
                        >
                            {(product.highlight || product.description) && (
                                <div className="description-area">
                                    {product.highlight && <h5>{product.highlight}</h5>}
                                    {product.description && <p style={{ whiteSpace: "pre-line" }}>{product.description}</p>}
                                </div>
                            )}
                            <ProductAccordion details={product.details} specsCare={product.specsCare} refundPolicy={settings.refundPolicy} />
                        </ProductDetailView>
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
