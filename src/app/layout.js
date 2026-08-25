import { DM_Sans, Anton } from "next/font/google";
import "./globals.css";
import BootstrapClient from "@/components/BootstrapClient";
import { AuthProvider } from "@/components/AuthProvider";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

// Bold, condensed, single-weight display face — used for punchy headline
// moments (e.g. the /signup chooser heading) where the site's default
// grunge/distressed "Cros" font hurts legibility over a photo background,
// but a plain body-copy weight of DM Sans reads as too generic.
const anton = Anton({
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
  weight: "400",
});

export const metadata = {
  title: "FlagMag",
  description: "Run Smarter Sports Leagues with Automated Scoring, Stats & Insights",
  icons: {
    icon: "/assets/images/favicon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="stylesheet" href="/assets/css/owl.carousel.min.css" />
        <link rel="stylesheet" href="/assets/css/owl.theme.default.min.css" />
        <link rel="stylesheet" href="/assets/css/jquery.fancybox.min.css" />
        <link rel="stylesheet" href="/assets/css/slick.css" />
      </head>
      <body className={`${dmSans.variable} ${anton.variable}`}>
        <AuthProvider>
          <div className="wrapper">
            {children}
          </div>
          <BootstrapClient />
        </AuthProvider>
      </body>
    </html>
  );
}

