import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import nextConfig from "../next.config.ts";
import sitemap from "../src/app/sitemap.ts";

test("/carteira possui uma única política efetiva noindex, nofollow e noarchive", async () => {
  const rules = await nextConfig.headers();
  const walletRules = rules.filter((rule) => rule.source === "/carteira/:path*");
  const robotHeaders = walletRules.flatMap((rule) => rule.headers)
    .filter((header) => header.key.toLowerCase() === "x-robots-tag");
  const layout = await readFile("src/app/carteira/layout.tsx", "utf8");

  assert.equal(walletRules.length, 1);
  assert.deepEqual(robotHeaders.map((header) => header.value), ["noindex, nofollow, noarchive"]);
  assert.doesNotMatch(layout, /robots\s*:/);
  assert.doesNotMatch(layout, /canonical\s*:/);
});

test("/carteira e áreas privadas não aparecem no sitemap público", () => {
  const urls = sitemap().map((entry) => new URL(entry.url).pathname);
  assert.ok(!urls.includes("/carteira"));
  assert.ok(!urls.some((path) => path.startsWith("/admin") || path.startsWith("/api")));
});

test("rota privada não adiciona JSON-LD, keywords ou canonical indexável", async () => {
  const page = await readFile("src/app/carteira/page.tsx", "utf8");
  const layout = await readFile("src/app/carteira/layout.tsx", "utf8");
  const combined = `${page}\n${layout}`;
  assert.doesNotMatch(combined, /application\/ld\+json|JSON-LD|keywords\s*:|canonical\s*:/i);
});

test("metadados públicos canônicos permanecem indexáveis e inalterados pela política privada", async () => {
  const rootLayout = await readFile("src/app/layout.tsx", "utf8");
  assert.match(rootLayout, /default: "Dados FII \| Fundos Imobiliários, dividendos e carteira"/);
  assert.match(rootLayout, /alternates: \{ canonical: "\.\/" \}/);
  assert.match(rootLayout, /robots:\s*\{\s*index: true,\s*follow: true/s);
  assert.match(rootLayout, /"google-adsense-account": ADSENSE_PUBLISHER_ID/);
});
