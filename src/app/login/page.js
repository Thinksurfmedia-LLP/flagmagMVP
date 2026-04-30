import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
    return (
        <>
            <section className="login-register-section">
                <div className="row g-0">
                    <div className="col-md-6 content-area-wrap">
                        <div className="content-area" style={{ width: "100%", maxWidth: "420px" }}>
                            <div className="logo-area" style={{ marginBottom: "40px" }}>
                                <img src="/assets/images/logo.png" alt="FlagMag" style={{ maxWidth: "220px" }} />
                            </div>
                            <h1 style={{ fontWeight: 800, fontSize: "42px", marginBottom: "15px" }}>Welcome back</h1>
                            <p style={{ color: "#8b90a0", marginBottom: "30px" }}>Sign in to your FlagMag account.</p>
                            <Suspense fallback={<div>Loading...</div>}>
                                <LoginForm />
                            </Suspense>
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
