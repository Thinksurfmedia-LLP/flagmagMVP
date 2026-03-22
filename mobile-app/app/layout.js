import "./globals.css";

export const metadata = {
    title: "FlagMag App",
    description: "FlagMag - Mobile Stats Recorder for Flag Football",
    viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
    icons: {
        icon: "/assets/images/favicon.png",
    },
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <head>
                <meta name="theme-color" content="#0B0D14" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <link rel="apple-touch-icon" href="/assets/images/logo.png" />
            </head>
            <body>
                {children}
            </body>
        </html>
    );
}
