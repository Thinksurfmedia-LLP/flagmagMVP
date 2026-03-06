export default function Footer() {
    return (
        <footer>
            <div className="container">
                <div className="top-area">
                    <img src="/assets/images/footer-logo.png" alt="" />
                    <ul className="contact">
                        <li><a href="#"><i className="fa-solid fa-phone"></i> +91-12682862355</a></li>
                        <li><a href="#"><i className="fa-solid fa-location-dot"></i> www.example.com</a></li>
                        <li><a href="#"><i className="fa-regular fa-envelope"></i> example@gmail.com</a></li>
                    </ul>
                    <ul className="contact social-icon">
                        <li><a href="#"><i className="fa-brands fa-facebook-f"></i></a></li>
                        <li><a href="#"><i className="fa-brands fa-twitter"></i></a></li>
                        <li><a href="#"><i className="fa-brands fa-instagram"></i></a></li>
                    </ul>
                </div>
            </div>

            <div className="copyright-area">
                <div className="container">
                    <div className="row align-items-center">
                        <div className="col-md mb-2 mb-md-0">
                            <p>All Rights Reserved © 2026</p>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
