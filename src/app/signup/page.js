import Link from "next/link";
import Footer from "@/components/Footer";
import SignupHeroLayout from "@/components/signup/SignupHeroLayout";
import SignupChoiceCards from "@/components/signup/SignupChoiceCards";

export default function SignupPage() {
    return (
        <>
            <SignupHeroLayout
                title="How do you want to join?"
                subtitle="Pick the option that fits — takes just a couple minutes to get started."
            >
                <SignupChoiceCards />
                <p style={{ color: "rgba(255,255,255,0.72)", marginTop: "36px", fontSize: "14px" }}>
                    Already have an account?{" "}
                    <Link href="/login" style={{ color: "#FF1E00", textDecoration: "none", fontWeight: 600 }}>
                        Log in here
                    </Link>
                </p>
            </SignupHeroLayout>

            <Footer />
        </>
    );
}
