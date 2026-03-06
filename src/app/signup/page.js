import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SignupForm from "@/components/SignupForm";

export default function SignupPage() {
    return (
        <>
            <Header variant="signup" />

            <section className="login-register-section">
                <div className="row g-0">
                    <div className="col-md-6 content-area-wrap">
                        <div className="content-area">
                            <div className="logo-area d-none">
                                <img src="/assets/images/logo.png" alt="" />
                            </div>
                            <h1>Let&apos;s create your account</h1>
                            <p>Signing up for Untitled UI is fast and 100% free.</p>
                            <SignupForm />
                        </div>
                    </div>
                    <div className="col-md-6 image-area">
                        &nbsp;
                    </div>
                </div>
            </section>

            <Footer />
        </>
    );
}
