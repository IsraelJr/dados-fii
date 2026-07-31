import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync("next.config.ts", "utf8");
const proxy = readFileSync("src/proxy.ts", "utf8");
const fundPage = readFileSync("src/app/fii/[ticker]/page.tsx", "utf8");
const pageHeader = readFileSync("src/app/components/PageHeader.tsx", "utf8");
const sourcePage = readFileSync("src/app/fontes-dos-dados/page.tsx", "utf8");
const footer = readFileSync("src/app/components/SiteFooter.tsx", "utf8");

test("[REG-DEF-20] todas as respostas recebem cabeçalhos defensivos e correlation ID", () => {
  for (const header of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy", "Cross-Origin-Opener-Policy"]) assert.match(config, new RegExp(header));
  assert.match(config, /frame-ancestors 'none'/);
  assert.match(config, /object-src 'none'/);
  assert.match(proxy, /x-correlation-id/);
  assert.match(proxy, /crypto\.randomUUID/);
  assert.doesNotMatch(proxy, /api\/fii\)\.\*/);
});

test("[REG-DEF-19] página de fundo possui um único h1 e não transfere QA ao usuário", () => {
  const h1Count = (fundPage.match(/<h1\b/g) || []).length + (pageHeader.match(/<h1\b/g) || []).length;
  assert.equal(h1Count, 1);
  assert.doesNotMatch(`${sourcePage}\n${footer}`, /Confirme dados relevantes|Confirme antes de decidir/);
});

test("canonical usa www e páginas privadas ou programáticas ficam fora do índice", () => {
  const site = readFileSync("src/lib/site.ts", "utf8");
  const walletLayout = readFileSync("src/app/carteira/layout.tsx", "utf8");
  const adminLayout = readFileSync("src/app/admin/layout.tsx", "utf8");
  const fundLayout = readFileSync("src/app/fii/[ticker]/layout.tsx", "utf8");
  const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
  const robots = readFileSync("src/app/robots.ts", "utf8");

  assert.match(site, /https:\/\/www\.dadosfii\.com\.br/);
  assert.doesNotMatch(walletLayout, /robots\s*:/);
  assert.match(config, /\{ source: "\/carteira\/:path\*", headers: noIndexHeaders \}/);
  assert.match(adminLayout, /index:\s*false/);
  assert.match(fundLayout, /index:\s*false,\s*follow:\s*true/);
  assert.doesNotMatch(sitemap, /\/fii\//);
  assert.doesNotMatch(sitemap, /regulatoryDataService|getFundDirectory|FALLBACK_TICKERS/);
  assert.match(sitemap, /SITE_URL/);
  assert.match(robots, /SITE_URL/);
});
