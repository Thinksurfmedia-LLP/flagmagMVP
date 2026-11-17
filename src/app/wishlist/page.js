import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WishlistGrid from "@/components/store/WishlistGrid";

export const metadata = { title: "My Wishlist | FlagMag" };

export default function WishlistPage() {
    return (
        <>
            <Header />

            <section className="wishlist-section section-padding">
                <div className="container">
                    <div className="heading-part">
                        <h2>My Wishlist</h2>
                        <p>Products you&apos;ve saved for later.</p>
                    </div>
                    <WishlistGrid />
                </div>
            </section>

            <Footer />
        </>
    );
}
