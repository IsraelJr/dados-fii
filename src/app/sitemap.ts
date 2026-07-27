import type { MetadataRoute } from "next";
import { safeLog } from "@/lib/observability/SafeLogger";
import { regulatoryDataService } from "@/lib/regulatoryDataService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const SITE_URL = "https://dadosfii.com.br";
const now = new Date();

const STATIC_ROUTES = [
  { path: "", changeFrequency: "daily" as const, priority: 1 },
  { path: "/calendario-dividendos-fiis", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/educacao", changeFrequency: "weekly" as const, priority: 0.75 },
  { path: "/glossario", changeFrequency: "weekly" as const, priority: 0.75 },
  { path: "/fontes-dos-dados", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/metodologia", changeFrequency: "monthly" as const, priority: 0.6 },
  { path: "/termos-de-uso", changeFrequency: "monthly" as const, priority: 0.4 },
  { path: "/politica-de-privacidade", changeFrequency: "monthly" as const, priority: 0.4 },
];

function normalizeTicker(value: unknown) {
  const ticker = String(value || "").trim().toUpperCase();
  return /^[A-Z0-9]{4,8}$/.test(ticker) ? ticker : "";
}

async function getFiiTickers() {
  try {
    const directory = await regulatoryDataService.getFundDirectory();
    if (!directory?.items?.length) {
      throw new Error("Diretório regulatório materializado ausente ou vazio.");
    }
    const tickers = directory.items
      .filter((item) => item.status === "active")
      .map((item) => normalizeTicker(item.ticker))
      .filter(Boolean);
    const unique = Array.from(new Set(tickers)).sort((a, b) => a.localeCompare(b));
    if (!unique.length) throw new Error("Diretório regulatório não contém tickers ativos válidos.");
    return unique;
  } catch (error) {
    safeLog("error", "seo.sitemap.directory.failed", { error });
    throw new Error("Não foi possível gerar o sitemap dinâmico a partir do diretório regulatório.");
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tickers = await getFiiTickers();

  const staticPages = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const fiiPages = tickers.map((ticker) => ({
    url: `${SITE_URL}/fii/${ticker}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...fiiPages];
}
