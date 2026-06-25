import "./globals.css";

export const metadata = {
    title: "FlagMag App",
    description: "FlagMag - Mobile Stats Recorder for Flag Football",
    icons: {
        icon: "/assets/images/favicon.png",
    },
};

export const viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export default function RootLayout({ children }) {
    return (
        <html lang="en" data-scroll-behavior="smooth">
            <head>
                <meta name="theme-color" content="#0B0D14" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <link rel="apple-touch-icon" href="/assets/images/logo.png" />
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css" />
            </head>
            <body>
                {children}
            </body>
        </html>
    );
}
