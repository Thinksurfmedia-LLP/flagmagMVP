import Footer from "@/components/Footer";
import SignupHeroLayout from "@/components/signup/SignupHeroLayout";
import SignupFormCard from "@/components/signup/SignupFormCard";
import FreeAgentSignupForm from "@/components/signup/FreeAgentSignupForm";

export default async function FreeAgentSignupPage({ searchParams }) {
    const { org } = await searchParams;

    return (
        <>
            <SignupHeroLayout
                title="Register as a Free Agent"
                subtitle="Pick a league and we'll list you for teams to draft."
                maxWidth="900px"
                showLogo={false}
            >
                <SignupFormCard>
                    <FreeAgentSignupForm defaultOrgSlug={org || ""} />
                </SignupFormCard>
            </SignupHeroLayout>

            <Footer />
        </>
    );
}
