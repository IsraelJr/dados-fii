import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

const REQUIRED_FILES = [
  "src/app/mercado/page.tsx",
  "src/app/mercado/[slug]/page.tsx",
  "src/app/components/MarketArticlePage.tsx",
  "src/app/components/EditorialTelemetry.tsx",
  "src/lib/editorial/marketContent.ts",
  "src/lib/editorial/copomAugust2026.ts",
  "src/lib/editorial/EditorialEvent.ts",
  "src/app/api/editorial/events/route.ts",
  "src/server/controllers/EditorialEventController.ts",
  "src/server/repositories/FirestoreEditorialEventRepository.ts",
];

test("PV-3.5 possui hub, sete páginas e camada editorial própria", () => {
  for (const path of REQUIRED_FILES) assert.equal(existsSync(path), true, `arquivo ausente: ${path}`);
  const registry = read("src/lib/editorial/marketContent.ts");
  for (const slug of [
    "mercado-de-fiis",
    "fiagro-agronegocio",
    "galpoes-logistica",
    "shoppings",
    "escritorios-lajes-corporativas",
    "recebiveis-papel",
    "renda-urbana",
  ]) assert.ok(registry.includes(`slug: "${slug}"`), `cenário ausente: ${slug}`);
});

test("metadados, canonical, Article e BreadcrumbList são derivados do registro", () => {
  const hub = read("src/app/mercado/page.tsx");
  const route = read("src/app/mercado/[slug]/page.tsx");
  const article = read("src/app/components/MarketArticlePage.tsx");
  assert.match(hub, /alternates: \{ canonical: "\/mercado" \}/);
  assert.match(hub, /"@type": "CollectionPage"/);
  assert.match(hub, /"@type": "ItemList"/);
  assert.match(route, /alternates: \{ canonical: `\/mercado\/\$\{article\.slug\}` \}/);
  assert.match(route, /generateStaticParams/);
  assert.match(route, /publishedTime: article\.datePublished/);
  assert.match(route, /modifiedTime: article\.dateModified/);
  assert.match(article, /"@type": "Article"/);
  assert.match(article, /"@type": "BreadcrumbList"/);
  assert.match(article, /citation: article\.sources\.map/);
});

test("sitemap e navegação incluem o hub sem liberar páginas desconhecidas", () => {
  const sitemap = read("src/app/sitemap.ts");
  const nav = read("src/app/components/SiteNav.tsx");
  assert.match(sitemap, /PUBLISHED_MARKET_ARTICLES/);
  assert.match(sitemap, /\/mercado\/\$\{article\.slug\}/);
  assert.match(sitemap, /filter\(\(article\) => article\.indexable\)/);
  assert.match(sitemap, /article\.dateModified/);
  assert.match(nav, /href: "\/mercado"/);
  assert.match(nav, /label: "Mercado"/);
});

test("rota editorial permanece fina e Firestore fica no repositório", () => {
  const route = read("src/app/api/editorial/events/route.ts");
  const controller = read("src/server/controllers/EditorialEventController.ts");
  const repository = read("src/server/repositories/FirestoreEditorialEventRepository.ts");
  assert.match(route, /export \{ POST \} from "@\/server\/controllers\/EditorialEventController"/);
  assert.doesNotMatch(route, /firebase|Firestore|adminDb|collection\(/i);
  assert.doesNotMatch(controller, /adminDb|collection\(/);
  assert.match(repository, /adminDb\.collection/);
});

test("telemetria editorial não envia identidade ou valores financeiros", () => {
  const event = read("src/lib/editorial/EditorialEvent.ts");
  const client = read("src/app/components/EditorialTelemetry.tsx");
  const repository = read("src/server/repositories/FirestoreEditorialEventRepository.ts");
  const combined = `${event}\n${client}\n${repository}`;
  for (const forbidden of ["ownerId", "email", "token", "cookie", "patrimony", "dividend", "position", "ticker", "quotas"]) {
    assert.equal(new RegExp(`\\b${forbidden}\\b`, "i").test(combined), false, `campo proibido: ${forbidden}`);
  }
  assert.match(client, /credentials: "omit"/);
  assert.match(event, /90 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(repository, /expiresAt/);
});

test("conteúdo exibe data-base, fontes, limitações e ausência de recomendação", () => {
  const article = read("src/app/components/MarketArticlePage.tsx");
  const registry = read("src/lib/editorial/marketContent.ts");
  const copomUpdate = read("src/lib/editorial/copomAugust2026.ts");
  assert.match(article, /Data-base:/);
  assert.match(article, /Fontes e atualização/);
  assert.match(article, /Sem recomendação de compra ou venda/);
  assert.match(registry, /Limitações desta leitura/g);
  assert.doesNotMatch(`${registry}\n${copomUpdate}`, /compre agora|venda agora|recomendamos comprar|recomendamos vender/i);
});
