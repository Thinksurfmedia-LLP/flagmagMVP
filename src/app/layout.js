import { DM_Sans } from "next/font/google";
import "./globals.css";
import BootstrapClient from "@/components/BootstrapClient";
import { AuthProvider } from "@/components/AuthProvider";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
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
    <html lang="en">
      <head>
        {/* Vendor CSS loaded via link tags (they contain url() refs that webpack can't resolve) */}
        <link rel="stylesheet" href="/assets/css/owl.carousel.min.css" />
        <link rel="stylesheet" href="/assets/css/owl.theme.default.min.css" />
        <link rel="stylesheet" href="/assets/css/jquery.fancybox.min.css" />
      </head>
      <body className={dmSans.variable}>
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
