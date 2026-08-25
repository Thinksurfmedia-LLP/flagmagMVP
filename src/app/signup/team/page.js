import Footer from "@/components/Footer";
import SignupHeroLayout from "@/components/signup/SignupHeroLayout";
import SignupFormCard from "@/components/signup/SignupFormCard";
import TeamSignupForm from "@/components/signup/TeamSignupForm";

export default function TeamSignupPage() {
    return (
        <>
            <SignupHeroLayout
                title="Register your Team"
                subtitle="Pick a league — your team goes live once an organizer places it in a division."
                maxWidth="900px"
                showLogo={false}
            >
                <SignupFormCard>
                    <TeamSignupForm />
                </SignupFormCard>
            </SignupHeroLayout>

            <Footer />
        </>
    );
}
