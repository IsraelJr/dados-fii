import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const DOMAIN_DIR = path.join(ROOT, "src/lib/portfolio-intelligence");

async function domainSources() {
  const names = (await readdir(DOMAIN_DIR)).filter((name) => name.endsWith(".ts"));
  return Promise.all(names.map(async (name) => ({
    name,
    source: await readFile(path.join(DOMAIN_DIR, name), "utf8"),
  })));
}

test("domínio de inteligência não depende de React, Next, Firestore ou OpenAI", async () => {
  const sources = await domainSources();
  const combined = sources.map(({ source }) => source).join("\n");
  assert.doesNotMatch(combined, /from\s+["']react["']/);
  assert.doesNotMatch(combined, /from\s+["']next(?:\/[^"']*)?["']/);
  assert.doesNotMatch(combined, /firebase|Firestore|OpenAI|openai/i);
  assert.doesNotMatch(combined, /console\.(?:log|info|warn|error)|track\(|telemetry/i);
});

test("política 1.0.0 centraliza os thresholds obrigatórios", async () => {
  const source = await readFile(
    path.join(DOMAIN_DIR, "PortfolioIntelligencePolicy.ts"),
    "utf8",
  );
  assert.match(source, /PORTFOLIO_INTELLIGENCE_POLICY_VERSION = "1\.0\.0"/);
  for (const contract of [
    /minimumMonths: 6/,
    /risingThresholdPercent: 5/,
    /fallingThresholdPercent: -5/,
    /signalThresholdPercent: 20/,
    /largestPositionThresholdPercent: 30/,
    /topThreeThresholdPercent: 70/,
    /hhiThreshold: 2_500/,
    /singleFundThresholdPercent: 35/,
    /minimumCoveragePercent: 70/,
    /concentrationThresholdPercent: 50/,
    /robustScoreThreshold: 3\.5/,
  ]) assert.match(source, contract);
});

test("carteira integra exatamente consolidatedSnapshots e posições do RegulatoryDataService", async () => {
  const page = await readFile(path.join(ROOT, "src/app/carteira/page.tsx"), "utf8");
  const batchRoute = await readFile(path.join(ROOT, "src/app/api/fii/batch/route.ts"), "utf8");
  assert.match(page, /intelligenceSnapshotsFromConsolidated\(consolidatedSnapshots\)/);
  assert.match(page, /intelligencePositionsFromCurrentWallet\(insights\.enriched\.map/);
  assert.match(page, /<PortfolioIntelligencePanel result=\{portfolioIntelligence\}/);
  assert.match(page, /<PortfolioIntelligenceLoading \/>/);
  assert.match(page, /portfolioIntelligenceLoading/);
  assert.match(batchRoute, /regulatoryDataService\.getMany\(tickers\)/);
  assert.doesNotMatch(batchRoute, /firebase|Firestore|adminDb/i);
});

test("não existe route handler, persistência ou chamada de IA para o diagnóstico", async () => {
  const routesRoot = path.join(ROOT, "src/app/api");
  const pending = [routesRoot];
  const matchingRoutes = [];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(absolute);
      else if (/portfolio-intelligence/i.test(absolute)) matchingRoutes.push(absolute);
    }
  }
  assert.deepEqual(matchingRoutes, []);
  const sources = await domainSources();
  const combined = sources.map(({ source }) => source).join("\n");
  assert.doesNotMatch(combined, /fetch\(|generateText|AIInsights|adminDb|firebase-admin/i);
});

test("painel é semântico, expansível, acessível e não calcula métricas", async () => {
  const source = await readFile(
    path.join(ROOT, "src/app/components/PortfolioIntelligencePanel.tsx"),
    "utf8",
  );
  assert.match(source, /aria-labelledby="portfolio-intelligence-title"/);
  assert.match(source, /<h2 id="portfolio-intelligence-title"/);
  assert.match(source, /aria-expanded=\{expanded\}/);
  assert.match(source, /aria-controls="portfolio-intelligence-signals"/);
  assert.match(source, /focus-visible:ring-2/);
  assert.match(source, /dark:/);
  assert.match(source, /Resumo da inteligência da carteira/);
  assert.match(source, /Dados usados nesta análise/);
  assert.match(source, /data-quality-reason/);
  assert.match(source, /PortfolioIntelligenceLoading/);
  assert.match(source, /aria-busy="true"/);
  assert.match(source, /Conteúdo informativo, sem recomendação de investimento\./);
  assert.doesNotMatch(source, /\.reduce\(|Math\.(?:max|min|sqrt|pow)|OpenAI|compre|venda/i);
});

test("modelo de apresentação recebe somente o resultado e não recalcula política financeira", async () => {
  const source = await readFile(
    path.join(DOMAIN_DIR, "PortfolioIntelligencePresentation.ts"),
    "utf8",
  );
  const panel = await readFile(
    path.join(ROOT, "src/app/components/PortfolioIntelligencePanel.tsx"),
    "utf8",
  );
  assert.match(source, /buildPortfolioIntelligencePresentation\(\s*result: PortfolioIntelligenceResult/);
  assert.match(panel, /buildPortfolioIntelligencePresentation\(result\)/);
  assert.match(panel, /useMemo\(\(\) => buildPortfolioIntelligencePresentation\(result\), \[result\]\)/);
  assert.doesNotMatch(source, /PortfolioIntelligencePolicy|PORTFOLIO_INTELLIGENCE_POLICY/);
  assert.doesNotMatch(source, /Math\.(?:max|min|sqrt|pow)|\.reduce\(|fetch\(|localStorage|sessionStorage|OpenAI/i);
  assert.doesNotMatch(panel, /(?:estimatedIncomeTotal|hhi|average|sharePercent)\s*[+*/-]/i);
});

test("inteligência continua sem fetch, persistência ou estado derivado durável", async () => {
  const model = await readFile(path.join(DOMAIN_DIR, "PortfolioIntelligencePresentation.ts"), "utf8");
  const panel = await readFile(path.join(ROOT, "src/app/components/PortfolioIntelligencePanel.tsx"), "utf8");
  const combined = `${model}\n${panel}`;
  assert.doesNotMatch(combined, /fetch\(|localStorage|sessionStorage|indexedDB|analytics|telemetry|console\./i);
});

test("arquitetura não altera autenticação, entitlement, Risk Lab ou relatório Premium", async () => {
  const changedRuntimeReferences = (await domainSources())
    .map(({ source }) => source)
    .join("\n");
  assert.doesNotMatch(
    changedRuntimeReferences,
    /WalletSession|WalletIdentity|isVip|PREMIUM|RiskLab|WalletRiskReport/i,
  );
});
