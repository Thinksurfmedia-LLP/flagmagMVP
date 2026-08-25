import Footer from "@/components/Footer";
import SignupHeroLayout from "@/components/signup/SignupHeroLayout";
import SignupFormCard from "@/components/signup/SignupFormCard";
import CustomPaymentForm from "@/components/signup/CustomPaymentForm";

export default function CustomPaymentPage() {
    return (
        <>
            <SignupHeroLayout
                title="Make a Payment"
                subtitle="Pay any amount securely via PayPal — no account required."
                maxWidth="900px"
                showLogo={false}
            >
                <SignupFormCard>
                    <CustomPaymentForm />
                </SignupFormCard>
            </SignupHeroLayout>

            <Footer />
        </>
    );
}
