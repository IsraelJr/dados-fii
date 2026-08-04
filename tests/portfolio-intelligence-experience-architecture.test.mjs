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

test("painel recebe resultado pronto, chama somente a rota interna e não recalcula métricas", async () => {
  const panel = await read("src/app/components/PortfolioIntelligencePanel.tsx");

  assert.match(panel, /buildPortfolioIntelligencePresentation\(result\)/);
  assert.match(panel, /useMemo\(\(\) => buildPortfolioIntelligencePresentation\(result\), \[result\]\)/);
  assert.match(panel, /fetch\("\/api\/portfolio\/intelligence\/explanation"/);
  assert.equal((panel.match(/fetch\(/g) || []).length, 1);
  assert.match(panel, /onClick=\{\(\) => void explainWithAI\(\)\}/);
  assert.match(panel, /A IA recebe somente os sinais e métricas já calculados/);
  assert.match(panel, /aria-labelledby="portfolio-intelligence-title"/);
  assert.match(panel, /aria-busy="true"/);
  assert.match(panel, /aria-expanded=\{expanded\}/);
  assert.match(panel, /aria-controls="portfolio-intelligence-signals"/);
  assert.match(panel, /focus-visible:ring-2/);
  assert.doesNotMatch(panel, /\.reduce\(|Math\.(?:max|min|sqrt|pow)|localStorage|sessionStorage|OpenAI|api\.openai\.com/i);
});

test("modelos de apresentação e fallback são puros e não replicam a política financeira", async () => {
  const presentation = await read("src/lib/portfolio-intelligence/PortfolioIntelligencePresentation.ts");
  const contract = await read("src/lib/portfolio-intelligence/PortfolioIntelligenceAIContract.ts");
  const index = await read("src/lib/portfolio-intelligence/index.ts");

  assert.match(presentation, /buildPortfolioIntelligencePresentation\(\s*result: PortfolioIntelligenceResult/);
  assert.match(contract, /buildPortfolioIntelligenceAIFallback/);
  assert.match(contract, /buildPortfolioIntelligenceAISafeInput/);
  assert.match(index, /export \* from "\.\/PortfolioIntelligencePresentation"/);
  assert.match(index, /export \* from "\.\/PortfolioIntelligenceAIContract"/);
  assert.doesNotMatch(`${presentation}\n${contract}`, /from\s+["']react["']|from\s+["']next|fetch\(|localStorage|sessionStorage|firebase|Firestore|OpenAI|console\./i);
  assert.doesNotMatch(presentation, /Math\.(?:max|min|sqrt|pow)|\.reduce\(/);
});

test("rota valida tamanho e delega sem acesso direto a OpenAI ou Firestore", async () => {
  const route = await read("src/app/api/portfolio/intelligence/explanation/route.ts");

  assert.match(route, /MAX_BODY_BYTES = 80_000/);
  assert.match(route, /Buffer\.byteLength\(raw, "utf8"\)/);
  assert.match(route, /portfolioIntelligenceAIService\.explain/);
  assert.match(route, /"Cache-Control": "no-store"/);
  assert.match(route, /requestKey\(request\)/);
  assert.doesNotMatch(route, /api\.openai\.com|AIInsightsEngine|firebase|Firestore|adminDb|RegulatoryRepository/);
});

test("serviço server-side usa cache, deduplicação, rate limit e entrada sanitizada", async () => {
  const service = await read("src/lib/portfolio-intelligence/PortfolioIntelligenceAIService.ts");

  assert.match(service, /buildPortfolioIntelligenceAISafeInput\(result\)/);
  assert.match(service, /new RegulatoryCache<PortfolioIntelligenceAIExplanation>/);
  assert.match(service, /this\.inFlight\.get\(inputFingerprint\)/);
  assert.match(service, /consumeRateLimit\(options\.requestKey\)/);
  assert.match(service, /purpose: "portfolio-intelligence-explanation"/);
  assert.match(service, /Não refaça fórmulas, não altere números/);
  assert.match(service, /Não sugira comprar, vender, manter, aportar/);
  assert.doesNotMatch(service, /firebase|Firestore|adminDb|RegulatoryRepository/);
});

test("experiência não persiste explicação nem envia telemetria financeira", async () => {
  const panel = await read("src/app/components/PortfolioIntelligencePanel.tsx");
  const presentation = await read("src/lib/portfolio-intelligence/PortfolioIntelligencePresentation.ts");
  const combined = `${panel}\n${presentation}`;

  assert.doesNotMatch(combined, /localStorage|sessionStorage|indexedDB|analytics|telemetry|console\./i);
  assert.doesNotMatch(panel, /apiKey|Authorization|Bearer|OPENAI_API_KEY/);
});
