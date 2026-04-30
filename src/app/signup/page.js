import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SignupForm from "@/components/SignupForm";

export default function SignupPage() {
    return (
        <>
            <section className="login-register-section">
                <div className="row g-0">
                    <div className="col-md-6 content-area-wrap">
                        <div className="content-area" style={{ width: "100%", maxWidth: "420px" }}>
                            <div className="logo-area" style={{ marginBottom: "40px" }}>
                                <img src="/assets/images/logo.png" alt="FlagMag" style={{ maxWidth: "220px" }} />
                            </div>
                            <h1 style={{ fontWeight: 800, fontSize: "42px", marginBottom: "15px", lineHeight: "1.1" }}>Let&apos;s create your account</h1>
                            <p style={{ color: "#8b90a0", marginBottom: "30px" }}>Signing up for FlagMag is fast and 100% free.</p>
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
