/**
 * Shared full-bleed blurred-photo hero shell for every /signup* page —
 * the chooser and all three registration forms sit on the same backdrop
 * for visual consistency across the flow.
 */
export default function SignupHeroLayout({ title, subtitle, maxWidth = "780px", showLogo = true, children }) {
    return (
        <section
            style={{
                position: "relative",
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                padding: "60px 20px",
            }}
        >
            {/* Blurred flag-football photo backdrop — scaled up so the
                blur filter never reveals a sharp edge at the section's
                boundary. */}
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: "url(/assets/images/login-bg.jpg)",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    filter: "blur(14px)",
                    transform: "scale(1.15)",
                }}
            />
            {/* Dark overlay for text contrast, tinted to the site's
                near-black brand background rather than plain black. */}
            <div
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(180deg, rgba(11,13,20,0.82) 0%, rgba(11,13,20,0.9) 100%)",
                }}
            />

            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    maxWidth,
                    width: "100%",
                }}
            >
                {showLogo && (
                    <img src="/assets/images/logo.png" alt="FlagMag" style={{ maxWidth: "200px", marginBottom: "36px" }} />
                )}
                <h1
                    style={{
                        fontFamily: "var(--font-anton), sans-serif",
                        fontWeight: 400,
                        fontSize: "40px",
                        marginBottom: "15px",
                        lineHeight: "1.1",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                        color: "#fff",
                    }}
                >
                    {title}
                </h1>
                {subtitle && (
                    <p style={{ color: "rgba(255,255,255,0.72)", marginBottom: "36px", fontSize: "16px" }}>{subtitle}</p>
                )}
                {children}
            </div>
        </section>
    );
}
