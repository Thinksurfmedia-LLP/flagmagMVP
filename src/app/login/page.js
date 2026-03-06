import { Suspense } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
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
                            <h1>Welcome back</h1>
                            <p>Sign in to your FlagMag account.</p>
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
