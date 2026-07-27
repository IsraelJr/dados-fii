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
  for (const header of [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Cross-Origin-Opener-Policy",
  ]) {
    assert.match(config, new RegExp(header));
  }
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

test("canonical é relativo por rota e carteira privada não entra no sitemap", () => {
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const walletLayout = readFileSync("src/app/carteira/layout.tsx", "utf8");
  const sitemap = readFileSync("src/app/sitemap.ts", "utf8");

  assert.match(layout, /canonical:\s*["']\.\/["']/);
  assert.match(walletLayout, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false/s);
  assert.doesNotMatch(sitemap, /path:\s*["']\/carteira["']/);
  assert.match(sitemap, /regulatoryDataService\.getFundDirectory/);
  assert.doesNotMatch(sitemap, /adminDb|FALLBACK_TICKERS/);
  assert.match(sitemap, /throw new Error\("Não foi possível gerar o sitemap dinâmico/);
});
