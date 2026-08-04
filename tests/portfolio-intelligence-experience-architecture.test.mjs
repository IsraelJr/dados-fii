import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("carteira deriva a inteligência somente da série consolidada e das posições atuais", async () => {
  const page = await read("src/app/carteira/page.tsx");

  assert.match(page, /intelligenceSnapshotsFromConsolidated\(consolidatedSnapshots\)/);
  assert.match(page, /intelligencePositionsFromCurrentWallet\(insights\.enriched\.map/);
  assert.match(page, /portfolioIntelligenceService\.analyzeSafely/);
  assert.match(page, /price: price > 0 \? price : null/);
  assert.match(page, /estimatedIncome: item\.lastDividend \? item\.estimatedIncome : null/);
  assert.match(page, /segment: item\.data\?\.segment_new \|\| item\.data\?\.segment \|\| null/);
  assert.match(page, /<PortfolioIntelligenceLoading \/>/);
  assert.match(page, /<PortfolioIntelligencePanel result=\{portfolioIntelligence\} \/>/);
  assert.doesNotMatch(page, /new PortfolioIntelligenceService|OpenAI|firebase-admin|adminDb/);
});

test("painel recebe resultado pronto, possui estados acessíveis e não recalcula métricas", async () => {
  const panel = await read("src/app/components/PortfolioIntelligencePanel.tsx");

  assert.match(panel, /buildPortfolioIntelligencePresentation\(result\)/);
  assert.match(panel, /useMemo\(\(\) => buildPortfolioIntelligencePresentation\(result\), \[result\]\)/);
  assert.match(panel, /aria-labelledby="portfolio-intelligence-title"/);
  assert.match(panel, /aria-busy="true"/);
  assert.match(panel, /aria-expanded=\{expanded\}/);
  assert.match(panel, /aria-controls="portfolio-intelligence-signals"/);
  assert.match(panel, /focus-visible:ring-2/);
  assert.match(panel, /Conteúdo informativo, sem recomendação de investimento\./);
  assert.doesNotMatch(panel, /\.reduce\(|Math\.(?:max|min|sqrt|pow)|fetch\(|localStorage|sessionStorage|OpenAI/i);
});

test("modelo de apresentação é puro e não replica a política financeira", async () => {
  const presentation = await read("src/lib/portfolio-intelligence/PortfolioIntelligencePresentation.ts");
  const index = await read("src/lib/portfolio-intelligence/index.ts");

  assert.match(presentation, /buildPortfolioIntelligencePresentation\(\s*result: PortfolioIntelligenceResult/);
  assert.match(index, /export \* from "\.\/PortfolioIntelligencePresentation"/);
  assert.doesNotMatch(presentation, /PortfolioIntelligencePolicy|PORTFOLIO_INTELLIGENCE_POLICY/);
  assert.doesNotMatch(presentation, /from\s+["']react["']|from\s+["']next|fetch\(|localStorage|sessionStorage|firebase|Firestore|OpenAI|console\./i);
  assert.doesNotMatch(presentation, /Math\.(?:max|min|sqrt|pow)|\.reduce\(/);
});

test("experiência não cria API, persistência ou telemetria financeira", async () => {
  const page = await read("src/app/carteira/page.tsx");
  const panel = await read("src/app/components/PortfolioIntelligencePanel.tsx");
  const presentation = await read("src/lib/portfolio-intelligence/PortfolioIntelligencePresentation.ts");
  const combined = `${panel}\n${presentation}`;

  assert.doesNotMatch(combined, /fetch\(|localStorage|sessionStorage|indexedDB|analytics|telemetry|console\./i);
  assert.doesNotMatch(page, /\/api\/portfolio-intelligence/);
});
