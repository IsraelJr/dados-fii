import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import AdSenseLoader from "./components/AdSenseLoader";
import CookieBanner from "./components/CookieBanner";
import SiteFooter from "./components/SiteFooter";
import SiteNav from "./components/SiteNav";
import UserNotificationCenter from "./components/UserNotificationCenter";
import WalletSessionRecoveryBoundary from "./components/WalletSessionRecoveryBoundary";
import { ADSENSE_PUBLISHER_ID, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Dados FII | Fundos Imobiliários, dividendos e carteira",
    template: "%s | Dados FII",
  },
  description:
    "Consulte FIIs, dividendos, próximos pagamentos, carteira, notícias e dados de fundos imobiliários em linguagem simples.",
  applicationName: SITE_NAME,
  keywords: [
    "FIIs",
    "fundos imobiliários",
    "dividendos FIIs",
    "calendário de dividendos",
    "carteira de FIIs",
    "dados FII",
    "rendimentos FIIs",
    "fundos imobiliários Brasil",
  ],
  authors: [{ name: SITE_NAME, url: "/sobre" }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: { canonical: "./" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Dados FII | Fundos Imobiliários, dividendos e carteira",
    description:
      "Consulte FIIs, dividendos, próximos pagamentos, carteira, notícias e dados de fundos imobiliários em linguagem simples.",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary",
    title: "Dados FII | Fundos Imobiliários, dividendos e carteira",
    description:
      "Consulte FIIs, dividendos, próximos pagamentos, carteira, notícias e dados de fundos imobiliários em linguagem simples.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/logo.png",
  },
  other: {
    "google-adsense-account": ADSENSE_PUBLISHER_ID,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <Script id="dados-fii-consent-default" strategy="beforeInteractive">
        {`window.dataLayer=window.dataLayer||[];window.dataLayer.push(['consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500}]);`}
      </Script>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-slate-50 text-slate-900 antialiased`}>
        <AdSenseLoader />
        <WalletSessionRecoveryBoundary />
        <SiteNav />
        <UserNotificationCenter />
        {children}
        <SiteFooter />
        <CookieBanner global />
      </body>
    </html>
  );
}
