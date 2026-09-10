import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata = {
    title: "Privacy Policy | FLAGMAG",
    description: "Privacy policy for the FLAGMAG platform.",
};

export default function PrivacyPolicy() {
    return (
        <>
            <Header />

            <section className="innerpage-section">
                <div className="banner-area"><img src="/assets/images/inner-banner1.jpg" alt="" /></div>
                <div className="container">
                    <div className="breadcrumb-area">
                        <h1>Privacy Policy</h1>
                    </div>
                </div>
            </section>

            <section className="section-padding">
                <div className="container">
                    <p>This privacy policy discloses the privacy practices for the FLAGMAG platform. This notice applies solely to information collected through this website and its associated apps. It will notify you of the following:</p>
                    <ul className="list2">
                        <li>What personally identifiable information is collected from you, how it is used, and with whom it may be shared.</li>
                        <li>What choices are available to you regarding the use of your data.</li>
                        <li>The security procedures in place to protect the misuse of your information.</li>
                        <li>How you can correct any inaccuracies in the information.</li>
                    </ul>

                    <h2>Information Collection, Use, and Sharing</h2>
                    <p>We are the sole owners of the information collected on this platform. We only collect information that you voluntarily provide — for example, when registering a team, joining a league, or contacting us directly. We will not sell or rent this information to anyone.</p>
                    <p>We use your information to operate the platform and respond to you, including managing league registrations, schedules, scores, and stats on behalf of the organizations you interact with. We will not share your information with any third party outside our organization, other than as necessary to provide our services — for example, to process a payment or facilitate a league or team registration.</p>
                    <p>Unless you ask us not to, we may contact you via email in the future about platform updates, new features, or changes to this privacy policy.</p>

                    <h2>Your Access to and Control Over Information</h2>
                    <p>You may opt out of any future contact from us at any time. You can do the following at any time by reaching out through the contact details provided on this website:</p>
                    <ul className="list2">
                        <li>See what data we have about you, if any.</li>
                        <li>Change or correct any data we have about you.</li>
                        <li>Have us delete any data we have about you.</li>
                        <li>Raise any concern you have about our use of your data.</li>
                    </ul>

                    <h2>Security</h2>
                    <p>We take precautions to protect your information. When you submit sensitive information through the platform, it is protected both online and offline.</p>
                    <p>Wherever we collect sensitive information (such as payment data), that information is encrypted and transmitted securely. You can verify this by looking for a closed lock icon in your browser, or &ldquo;https&rdquo; at the beginning of the page address.</p>
                    <p>While we use encryption to protect information transmitted online, we also protect it offline. Only staff who need the information to perform a specific job (for example, billing or support) are granted access to personally identifiable information, and it is stored in a secure environment.</p>

                    <p><strong>If you feel we are not abiding by this privacy policy, please contact us using the details provided on this website.</strong></p>
                    {/* <p>Effective Date: September 2026</p> */}
                </div>
            </section>

            <Footer />
        </>
    );
}
