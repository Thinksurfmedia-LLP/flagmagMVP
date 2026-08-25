import Footer from "@/components/Footer";
import SignupHeroLayout from "@/components/signup/SignupHeroLayout";
import SignupFormCard from "@/components/signup/SignupFormCard";
import SignupForm from "@/components/SignupForm";

export default function AccountSignupPage() {
    return (
        <>
            <SignupHeroLayout title="Let's create your account" subtitle="Signing up for FlagMag is fast and 100% free." maxWidth="480px" showLogo={false}>
                <SignupFormCard>
                    <SignupForm />
                </SignupFormCard>
            </SignupHeroLayout>

            <Footer />
        </>
    );
}
