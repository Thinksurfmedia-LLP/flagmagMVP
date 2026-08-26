import SignupCheckout from "@/components/signup/SignupCheckout";

export default async function SignupPage({ searchParams }) {
    const { org } = await searchParams;

    return <SignupCheckout orgSlug={org || ""} />;
}
