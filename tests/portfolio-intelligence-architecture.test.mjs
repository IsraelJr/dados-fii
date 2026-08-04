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

test("adaptadores mapeiam a série consolidada e as posições sem acoplamento de runtime", async () => {
  const source = await readFile(
    path.join(DOMAIN_DIR, "PortfolioIntelligenceAdapters.ts"),
    "utf8",
  );

  assert.match(source, /intelligenceSnapshotsFromConsolidated/);
  assert.match(source, /competence: snapshot\.monthKey/);
  assert.match(source, /dividends: snapshot\.estimatedMonthlyIncome/);
  assert.match(source, /intelligencePositionsFromCurrentWallet/);
  assert.match(source, /quantity: position\.quotas/);
  assert.match(source, /price: position\.price/);
  assert.match(source, /estimatedIncome: position\.estimatedIncome/);
  assert.match(source, /segment: position\.segment/);
  assert.doesNotMatch(
    source,
    /RegulatoryDataService|fetch\(|from\s+["']react["']|from\s+["']next|firebase|Firestore|OpenAI/i,
  );
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

test("barrel público expõe somente contratos e funções do núcleo determinístico", async () => {
  const source = await readFile(path.join(DOMAIN_DIR, "index.ts"), "utf8");
  for (const moduleName of [
    "PortfolioIntelligence",
    "PortfolioIntelligenceAdapters",
    "PortfolioIntelligenceDataQuality",
    "PortfolioIntelligenceMetrics",
    "PortfolioIntelligencePolicy",
    "PortfolioIntelligenceService",
    "PortfolioIntelligenceSignals",
  ]) {
    assert.match(source, new RegExp(`export \\* from ["']\\./${moduleName}["']`));
  }
  assert.doesNotMatch(source, /Panel|Component|Page|Route|Repository/);
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
