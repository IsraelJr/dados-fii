import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://dadosfii.com.br";
const now = new Date();

const STATIC_ROUTES = [
  "",
  "/carteira",
  "/calendario-dividendos-fiis",
  "/educacao",
];

const FEATURED_TICKERS = [
  "TGAR11",
  "VGIA11",
  "MXRF11",
  "VISC11",
  "BODB11",
  "BTLG11",
  "HGLG11",
  "KNRI11",
  "XPLG11",
  "XPML11",
  "HGRU11",
  "RBRR11",
  "KNSC11",
  "CPTS11",
  "KNCR11",
  "VGHF11",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" as const : "weekly" as const,
    priority: route === "" ? 1 : 0.8,
  }));

  const fiiPages = FEATURED_TICKERS.map((ticker) => ({
    url: `${SITE_URL}/fii/${ticker}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...fiiPages];
}
