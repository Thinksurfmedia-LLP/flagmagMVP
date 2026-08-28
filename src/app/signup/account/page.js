import { notFound } from "next/navigation";
import Footer from "@/components/Footer";
import SignupHeroLayout from "@/components/signup/SignupHeroLayout";
import SignupFormCard from "@/components/signup/SignupFormCard";
import SignupForm from "@/components/SignupForm";

// Self-serve account signup is disabled — registration now only happens
// through an org's own /signup?org=... checkout. Kept as dead code (not
// deleted) so it's a one-line revert if this changes.
export default function AccountSignupPage() {
    notFound();
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
