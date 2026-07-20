import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync(
  "src/app/api/admin/system/risk-lab/cohort-backtest/route.ts",
  "utf8",
);
const panel = readFileSync(
  "src/app/admin/risk-lab/CohortBacktestPanel.tsx",
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
    .replace(/^\s*\/\/.*$/gm, "");
}

test("API da coorte reutiliza autenticação Admin e só executa em Produção", () => {
  assert.match(route, /authorizeAdminRequest/);
  assert.match(route, /risk-lab-cohort-backtest-execute/);
  assert.match(route, /VERCEL_ENV !== "production"/);
  assert.match(route, /VERCEL_GIT_COMMIT_SHA/);
  assert.match(route, /riskLabCohortBacktestService\.run\(\)/);
  assert.match(route, /action !== "execute"/);
  assert.doesNotMatch(executable(route), /CRON_SECRET|ADMIN_EMAILS|firebaseAdmin|adminDb/);
});

test("botão executa com um clique sem aprovação técnica manual", () => {
  assert.match(panel, /method: "POST"/);
  assert.match(panel, /JSON\.stringify\(\{ action: "execute" \}\)/);
  assert.match(panel, /Executar pendências automaticamente/);
  assert.doesNotMatch(executable(panel), /type="checkbox"|confirmed|approve|reject|aprovar fundo/i);
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
  assert.doesNotMatch(executable(panel), /sendEmail|notification|premium\/report|AIInsightsEngine/);
});

test("navegação do Admin torna o acionamento encontrável", () => {
  assert.match(layout, /href: "\/admin\/risk-lab\/cohort-backtest"/);
  assert.match(layout, /Pendências Sprint 3\.5/);
});

test("push do marcador dispara o workflow de Produção sem depender de dispatch encadeado", () => {
  assert.match(
    workflow,
    /docs\/production-evidence\/risk-lab\/sprint-3-5-deploy-trigger\.json/,
  );
  assert.match(workflow, /src\/app\/api\/admin\/system\/risk-lab\/cohort-backtest\/\*\*/);
  assert.match(workflow, /RELEASE_COMMIT:\s*\$\{\{ github\.sha \}\}/);
  assert.match(workflow, /release.*RELEASE_COMMIT/);
});
