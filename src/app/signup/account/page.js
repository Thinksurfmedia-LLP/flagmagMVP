import Footer from "@/components/Footer";
import SignupHeroLayout from "@/components/signup/SignupHeroLayout";
import SignupFormCard from "@/components/signup/SignupFormCard";
import SignupForm from "@/components/SignupForm";

export default function AccountSignupPage() {
    return (
        <>
            <SignupHeroLayout title="Let's get you signed up" subtitle="One account for everything on FlagMag." maxWidth="480px" showLogo={false}>
                <SignupFormCard>
                    <SignupForm />
                </SignupFormCard>
            </SignupHeroLayout>

            <Footer />
        </>
    );
}
