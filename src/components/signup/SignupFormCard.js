/**
 * Glass-panel container for a signup form sitting on top of
 * SignupHeroLayout's blurred photo backdrop — keeps the multi-column form
 * grid visually contained instead of floating loose over the image.
 */
export default function SignupFormCard({ children }) {
    return (
        <div
            style={{
                width: "100%",
                textAlign: "left",
                padding: "32px",
                borderRadius: "20px",
                background: "rgba(255, 255, 255, 0.06)",
                border: "1px solid rgba(255, 255, 255, 0.14)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.25)",
            }}
        >
            {children}
        </div>
    );
}
