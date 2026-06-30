import type { MetadataRoute } from "next";
import { adminDb } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://dadosfii.com.br";
const now = new Date();

const STATIC_ROUTES = [
  "",
  "/carteira",
  "/calendario-dividendos-fiis",
  "/educacao",
];

const FALLBACK_TICKERS = [
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

function normalizeTicker(value: unknown) {
  const ticker = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(ticker) ? ticker : "";
}

async function getFiiTickers() {
  try {
    const snapshot = await adminDb.collection("Fiis").limit(5000).get();
    const tickers = snapshot.docs
      .map((doc) => normalizeTicker(doc.data()?.code || doc.id))
      .filter(Boolean);

    return Array.from(new Set(tickers)).sort((a, b) => a.localeCompare(b));
  } catch (err) {
    console.error("Erro ao gerar sitemap dinâmico de FIIs:", err);
    return FALLBACK_TICKERS;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tickers = await getFiiTickers();

  const staticPages = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "daily" as const : "weekly" as const,
    priority: route === "" ? 1 : 0.8,
  }));

  const fiiPages = tickers.map((ticker) => ({
    url: `${SITE_URL}/fii/${ticker}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...fiiPages];
}
