import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const LAST_EDITORIAL_REVIEW = new Date("2026-07-27T12:00:00-03:00");

const ROUTES = [
  { path: "", changeFrequency: "daily" as const, priority: 1 },
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

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: LAST_EDITORIAL_REVIEW,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
