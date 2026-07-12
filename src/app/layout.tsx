import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SiteFooter from "./components/SiteFooter";
import SiteNav from "./components/SiteNav";
import UserNotificationCenter from "./components/UserNotificationCenter";
import VipGiftPrompt from "./components/VipGiftPrompt";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const ADSENSE_CLIENT =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT ||
  process.env.NEXT_PUBLIC_ADS_OPEN ||
  "ca-pub-3245357129779122";

const SITE_URL = "https://dadosfii.com.br";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Dados FII | Fundos Imobiliários, dividendos e carteira",
    template: "%s | Dados FII",
  },
  description:
    "Consulte FIIs, dividendos, próximos pagamentos, carteira, notícias e dados de fundos imobiliários em linguagem simples.",
  applicationName: "Dados FII",
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
  authors: [{ name: "Dados FII" }],
  creator: "Dados FII",
  publisher: "Dados FII",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: SITE_URL,
    siteName: "Dados FII",
    title: "Dados FII | Fundos Imobiliários, dividendos e carteira",
    description:
      "Consulte FIIs, dividendos, próximos pagamentos, carteira, notícias e dados de fundos imobiliários em linguagem simples.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Dados FII",
      },
    ],
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-slate-50 text-slate-900 antialiased`}
      >
        <SiteNav />
        <UserNotificationCenter />
        <VipGiftPrompt />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
