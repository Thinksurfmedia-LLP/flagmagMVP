import Link from "next/link";
import HeaderAuth from "@/components/HeaderAuth";

export default function Header({ variant = "default" }) {
    const headerClass = variant === "homepage"
        ? "for-homepage"
        : variant === "signup"
            ? "for-signup"
            : "";

    return (
        <header className={headerClass}>
            <div className="top-header">
                <p>At the top - Flagmag has been industry leader in Flag Football for over 40 years!</p>
            </div>
            <div className="container-fluid">
                <div className="row justify-content-between align-items-center">
                    <div className="col-auto logo">
                        <Link href="/">
                            <img src="/assets/images/logo.png" alt="Logo" />
                        </Link>
                    </div>

                    <div className="col header-nav d-flex">
                        <nav className="navbar navbar-expand-lg">
                            <div className="container-fluid">
                                {/* Toggler */}
                                <button
                                    className="navbar-toggler"
                                    type="button"
                                    data-bs-toggle={variant === "homepage" ? "offcanvas" : "collapse"}
                                    data-bs-target={variant === "homepage" ? "#mobileMenu" : "#navbarText"}
                                    aria-controls={variant === "homepage" ? "mobileMenu" : "navbarText"}
                                    aria-expanded="false"
                                    aria-label="Toggle navigation"
                                >
                                    {variant === "homepage" ? (
                                        <i className="fa-solid fa-bars-staggered"></i>
                                    ) : (
                                        <span className="navbar-toggler-icon"></span>
                                    )}
                                </button>

                                {/* Desktop Menu */}
                                <div className={variant === "homepage" ? "collapse navbar-collapse d-none d-lg-flex" : "collapse navbar-collapse"} id="navbarText">
                                    <ul className={variant === "homepage" ? "navbar-nav me-auto mb-2 mb-md-0" : "navbar-nav me-auto mb-lg-0"}>
                                        <li className="nav-item"><Link className="nav-link" href="#">Features</Link></li>
                                        <li className="nav-item"><Link className="nav-link" href="#">Leagues</Link></li>
                                        <li className="nav-item"><Link className="nav-link" href="#">Tournaments</Link></li>
                                        <li className="nav-item"><Link className="nav-link" href="#">Store</Link></li>
                                        <li className="nav-item"><Link className="nav-link" href="#">Sponsors</Link></li>
                                        <li className="nav-item"><Link className="nav-link" href="#">Resources</Link></li>
                                    </ul>
                                </div>

                                {/* Offcanvas Mobile Menu (homepage variant only) */}
                                {variant === "homepage" && (
                                    <div className="offcanvas offcanvas-end d-lg-none" tabIndex="-1" id="mobileMenu">
                                        <div className="offcanvas-header">
                                            <div className="offcanvas-logo">
                                                <img src="/assets/images/logo.png" alt="" />
                                            </div>
                                            <button type="button" className="btn-close" data-bs-dismiss="offcanvas"></button>
                                        </div>
                                        <div className="offcanvas-body">
                                            <ul className="navbar-nav">
                                                <li className="nav-item"><Link className="nav-link" href="#">Features</Link></li>
                                                <li className="nav-item"><Link className="nav-link" href="#">Leagues</Link></li>
                                                <li className="nav-item"><Link className="nav-link" href="#">Tournaments</Link></li>
                                                <li className="nav-item"><Link className="nav-link" href="#">Store</Link></li>
                                                <li className="nav-item"><Link className="nav-link" href="#">Sponsors</Link></li>
                                                <li className="nav-item"><Link className="nav-link" href="#">Resources</Link></li>
                                            </ul>
                                            <div className="header-btn-col for-mobile">
                                                <Link href="/login" className="btn btn-info-primary">LOGIN</Link>
                                                <Link href="#" className="btn btn-primary btn-with-arrow">
                                                    BOOK a Demo <span><img src="/assets/images/btn-arrow.png" alt="" /></span>
                                                </Link>
                                            </div>
                                            <div className="social">
                                                <h5>Follow Us on</h5>
                                                <ul>
                                                    <li><a href="#"><i className="fa-brands fa-facebook-f"></i></a></li>
                                                    <li><a href="#"><i className="fa-brands fa-twitter"></i></a></li>
                                                    <li><a href="#"><i className="fa-brands fa-instagram"></i></a></li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </nav>
                        <HeaderAuth />
                    </div>
                </div>
            </div>
        </header>
    );
}

