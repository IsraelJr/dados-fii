import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  "src/app/api/admin/system/risk-lab/cohort-backtest/route.ts",
  "utf8",
);
const planner = readFileSync(
  "src/lib/risk-lab/RiskLabCohortAdvancePlanner.ts",
  "utf8",
);
const panel = readFileSync(
  "src/app/admin/risk-lab/CohortBacktestPanel.tsx",
  "utf8",
);
const client = readFileSync(
  "src/app/admin/risk-lab/cohortBacktestClient.ts",
  "utf8",
);
const page = readFileSync(
  "src/app/admin/risk-lab/cohort-backtest/page.tsx",
  "utf8",
);
const layout = readFileSync(
  "src/app/admin/risk-lab/layout.tsx",
  "utf8",
);
const workflow = readFileSync(
  ".github/workflows/risk-lab-cohort-backtest.yml",
  "utf8",
);

function executable(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*(?:\/\/|#).*$/gm, "");
}

test("API da coorte reutiliza autenticação Admin e executa etapas segmentadas só em Produção", () => {
  assert.match(route, /authorizeAdminRequest/);
  assert.match(route, /requireGithubActionsProductionIdentity/);
  assert.match(route, /risk-lab-cohort-backtest-execute/);
  assert.match(route, /VERCEL_ENV !== "production"/);
  assert.match(route, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(route, /segmentedRiskLabCohortBacktestService\.initialize\(\)/);
  assert.match(route, /segmentedRiskLabCohortBacktestService\.runTicker\(resolvedTicker\)/);
  assert.match(route, /segmentedRiskLabCohortBacktestService\.finalize\(\)/);
  assert.match(route, /new Set\(\["initialize", "case", "finalize", "advance"\]\)/);
  assert.match(route, /SEGMENTED_COHORT_TICKERS\.includes\(ticker\)/);
  assert.doesNotMatch(executable(route), /CRON_SECRET|ADMIN_EMAILS|firebaseAdmin|adminDb|x-admin-secret/);
});

test("advance delega ao planner puro a inicialização, próximo fundo ou finalização", () => {
  assert.match(route, /action === "advance"/);
  assert.match(route, /getPublicEvidence\(\)/);
  assert.match(route, /planRiskLabCohortAdvance/);
  assert.match(planner, /tickers\.find/);
  assert.match(planner, /action: "initialize"/);
  assert.match(planner, /action: "case"/);
  assert.match(planner, /action: "finalize"/);
  assert.match(planner, /action: "noop"/);
  assert.match(route, /nextAction/);
  assert.match(route, /nextTicker/);
});

test("botão executa com um clique sem aprovação técnica manual", () => {
  assert.match(panel, /executeSegmentedCohortBacktest/);
  assert.match(client, /method: "POST"/);
  assert.match(client, /postStage\("initialize"\)/);
  assert.match(client, /postStage\("case", ticker\)/);
  assert.match(client, /postStage\("finalize"\)/);
  assert.match(panel, /Executar pendências automaticamente/);
  assert.doesNotMatch(executable(`${panel}\n${client}`), /type="checkbox"|confirmed|approve|reject|aprovar fundo/i);
  assert.match(page, /Nenhum fundo é aprovado manualmente/);
});

test("painel expõe métricas, casos e blockers sem efeitos externos", () => {
  assert.match(panel, /falsePositives/);
  assert.match(panel, /falseNegatives/);
  assert.match(panel, /inconclusiveCases/);
  assert.match(panel, /sourceCoveragePercent/);
  assert.match(panel, /primaryEvidenceComplete/);
  assert.match(panel, /lookAheadDetected/);
  assert.match(panel, /evidence\.blockers/);
  assert.match(panel, /progresso já persistido no servidor/);
  assert.doesNotMatch(executable(`${panel}\n${client}`), /sendEmail|notification|premium\/report|AIInsightsEngine/);
});

test("navegação do Admin torna o acionamento encontrável", () => {
  assert.match(layout, /href: "\/admin\/risk-lab\/cohort-backtest"/);
  assert.match(layout, /Pendências Sprint 3\.5/);
});

test("workflow somente registra a release e deixa os casos para o backend", () => {
  assert.match(workflow, /^\s{2}workflow_dispatch:/m);
  assert.match(workflow, /risk-lab-3-5-20260720-v2/);
  assert.match(workflow, /RELEASE_COMMIT:\s*\$\{\{ inputs\.release_sha \}\}/);
  assert.match(workflow, /"action":"initialize"/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /getIDToken\("dados-fii-risk-lab-operation"\)/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.doesNotMatch(executable(workflow), /action=case|action=finalize|git\s+push|sleep|for\s+attempt/);
});
