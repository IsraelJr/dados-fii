import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  contract: new URL("../src/lib/portfolio-intelligence/PortfolioIntelligenceExplanation.ts", import.meta.url),
  service: new URL("../src/lib/portfolio-intelligence/PortfolioIntelligenceExplanationService.ts", import.meta.url),
  index: new URL("../src/lib/portfolio-intelligence/index.ts", import.meta.url),
  route: new URL("../src/app/api/portfolio/intelligence/explanation/route.ts", import.meta.url),
  panel: new URL("../src/app/components/PortfolioIntelligenceExplanationPanel.tsx", import.meta.url),
  parentPanel: new URL("../src/app/components/PortfolioIntelligencePanel.tsx", import.meta.url),
};

async function source(name) {
  return readFile(files[name], "utf8");
}

test("client barrel does not export the server-only explanation service", async () => {
  const index = await source("index");
  assert.match(index, /PortfolioIntelligenceExplanation/);
  assert.doesNotMatch(index, /PortfolioIntelligenceExplanationService/);
});

test("explanation service centralizes AI through AIInsightsEngine without direct provider access", async () => {
  const service = await source("service");
  assert.match(service, /AIInsightsEngine/);
  assert.match(service, /generateText/);
  assert.match(service, /RegulatoryCache/);
  assert.doesNotMatch(service, /api\.openai\.com|Authorization:\s*`Bearer|\bfetch\s*\(/);
  assert.doesNotMatch(service, /firebase|Firestore|RegulatoryRepository|NextResponse/);
  assert.doesNotMatch(service, /PORTFOLIO_EXPLANATION_CACHE_TTL_MS|OPENAI_PORTFOLIO_INTELLIGENCE_MODEL/);
});

test("route is thin, same-origin, private and isolated from Firestore and OpenAI", async () => {
  const route = await source("route");
  assert.match(route, /sameOrigin/);
  assert.match(route, /private, no-store/);
  assert.match(route, /MAX_BODY_BYTES/);
  assert.match(route, /sanitizePortfolioExplanationInput/);
  assert.match(route, /deterministic-fallback|fallback\(input\)/);
  assert.doesNotMatch(route, /firebase|Firestore|RegulatoryRepository|api\.openai\.com/);
});

test("client requests explanation only after an explicit user action", async () => {
  const panel = await source("panel");
  assert.match(panel, /onClick=\{generateExplanation\}/);
  assert.match(panel, /Explicar estes sinais/);
  assert.match(panel, /\/api\/portfolio\/intelligence\/explanation/);
  assert.doesNotMatch(panel, /useEffect|localStorage|sessionStorage|Firestore|AIInsightsEngine|PortfolioIntelligenceExplanationService/);
  assert.doesNotMatch(panel, /\b(?:calculate|recalculate|average|median|variationPercent|sharePercent)\b/);
});

test("parent panel preserves deterministic evidence and mounts the explanation below it", async () => {
  const parent = await source("parentPanel");
  assert.match(parent, /PortfolioIntelligenceExplanationPanel/);
  assert.match(parent, /Dados usados nesta análise/);
  assert.match(parent, /data-signal-code/);
  assert.match(parent, /Conteúdo informativo, sem recomendação de investimento/);
});

test("contract rejects novel numbers and investment recommendations from AI output", async () => {
  const contract = await source("contract");
  assert.match(contract, /hasDigits/);
  assert.match(contract, /hasInvestmentRecommendation/);
  assert.match(contract, /A IA explicou um sinal inexistente/);
  assert.match(contract, /deterministicFieldsAreImmutable/);
  assert.doesNotMatch(contract, /firebase|Firestore|fetch\s*\(|api\.openai\.com/);
});
