import type { MetadataRoute } from "next";
import { MARKET_ARTICLES } from "@/lib/editorial/marketContent";
import { isFundSeoManifestFresh } from "@/lib/seo/FundSeoManifest";
import { fundSeoManifestService } from "@/lib/seo/FundSeoManifestRuntime";
import { SITE_URL } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LAST_EDITORIAL_REVIEW = new Date("2026-08-04T12:00:00-03:00");

const ROUTES = [
  { path: "", changeFrequency: "daily" as const, priority: 1 },
  { path: "/mercado", changeFrequency: "weekly" as const, priority: 0.95 },
  { path: "/guias", changeFrequency: "monthly" as const, priority: 0.9 },
  { path: "/guias/fundos-imobiliarios", changeFrequency: "monthly" as const, priority: 0.9 },
  { path: "/guias/dividendos-de-fiis", changeFrequency: "monthly" as const, priority: 0.9 },
  { path: "/guias/risco-em-fiis", changeFrequency: "monthly" as const, priority: 0.9 },
  { path: "/guias/carteira-de-fiis", changeFrequency: "monthly" as const, priority: 0.9 },
  { path: "/calendario-dividendos-fiis", changeFrequency: "daily" as const, priority: 0.8 },
  { path: "/educacao", changeFrequency: "monthly" as const, priority: 0.75 },
  { path: "/glossario", changeFrequency: "monthly" as const, priority: 0.75 },
  { path: "/fontes-dos-dados", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/metodologia", changeFrequency: "monthly" as const, priority: 0.7 },
  { path: "/sobre", changeFrequency: "monthly" as const, priority: 0.65 },
  { path: "/politica-de-correcoes", changeFrequency: "yearly" as const, priority: 0.55 },
  { path: "/como-usamos-ia", changeFrequency: "monthly" as const, priority: 0.55 },
  { path: "/termos-de-uso", changeFrequency: "yearly" as const, priority: 0.3 },
  { path: "/politica-de-privacidade", changeFrequency: "yearly" as const, priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: LAST_EDITORIAL_REVIEW,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
  const marketRoutes: MetadataRoute.Sitemap = MARKET_ARTICLES
    .filter((article) => article.indexable)
    .map((article) => ({
      url: `${SITE_URL}/mercado/${article.slug}`,
      lastModified: new Date(`${article.asOf}T12:00:00-03:00`),
      changeFrequency: "monthly" as const,
      priority: 0.85,
    }));
  const editorialRoutes = [...staticRoutes, ...marketRoutes];

  try {
    const manifest = await fundSeoManifestService.getCurrent();
    if (!isFundSeoManifestFresh(manifest)) return editorialRoutes;
    const fundRoutes: MetadataRoute.Sitemap = manifest.entries
      .filter((entry) => entry.indexable && entry.canonicalPath && entry.lastModified)
      .map((entry) => ({
        url: `${SITE_URL}${entry.canonicalPath}`,
        lastModified: new Date(entry.lastModified!),
        changeFrequency: "daily" as const,
        priority: 0.8,
      }));
    return [...editorialRoutes, ...fundRoutes];
  } catch (error) {
    console.error("SEO sitemap manifest error", error instanceof Error ? error.message : "unknown");
    return editorialRoutes;
  }
}
