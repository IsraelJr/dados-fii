import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const productionWorkflow = readFileSync(".github/workflows/risk-lab-cohort-backtest.yml", "utf8");
const route = readFileSync("src/app/api/system/risk-lab-cohort-backtest/route.ts", "utf8");

function executable(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*#.*$/gm, "");
}

test("recovery por commit e marcador foram removidos definitivamente", () => {
  assert.equal(existsSync(".github/workflows/risk-lab-cohort-deploy-recovery.yml"), false);
  assert.equal(existsSync("docs/production-evidence/risk-lab/sprint-3-5-deploy-trigger.json"), false);
});

test("backtest possui apenas kickoff manual e uma chamada limitada", () => {
  assert.match(productionWorkflow, /^\s{2}workflow_dispatch:/m);
  assert.doesNotMatch(productionWorkflow, /^\s{2}(push|pull_request|schedule):/m);
  assert.match(productionWorkflow, /release_sha/);
  assert.match(productionWorkflow, /timeout-minutes:\s*5/);
  assert.equal((productionWorkflow.match(/curl\b/g) || []).length, 1);
  assert.match(productionWorkflow, /--max-time 75/);
  assert.match(productionWorkflow, /action=initialize/);
});

test("workflow não espera deploy, não processa fundos e não cria eventos em cascata", () => {
  const source = executable(productionWorkflow);
  assert.doesNotMatch(source, /\bsleep\b|for\s+attempt|while\s+true|seq\s+1/i);
  assert.doesNotMatch(source, /action=case|action=finalize|DEVA11|VSLH11|KNCR11|KNSC11|MCCI11|RBRY11/);
  assert.doesNotMatch(source, /git\s+(commit|push)|gh\s+(workflow|pr)|contents:\s*write|pull-requests:\s*write/i);
  assert.doesNotMatch(source, /npm\s+(install|ci)|actions\/checkout/);
});

test("kickoff permanece vinculado ao release exato de Produção", () => {
  assert.match(route, /parameters\.source === "github-actions"/);
  assert.match(route, /parameters\.runId === RISK_LAB_COHORT_BACKTEST_RUN_ID/);
  assert.match(route, /parameters\.release === deployedRelease/);
  assert.match(route, /VERCEL_ENV === "production"/);
  assert.match(productionWorkflow, /evidence\.releaseCommit == \$release/);
  assert.match(productionWorkflow, /evidence\.runId == \$runId/);
});

test("evidência intermediária é curta e não vira estado operacional", () => {
  assert.match(productionWorkflow, /retention-days:\s*3/);
  assert.match(productionWorkflow, /GITHUB_STEP_SUMMARY/);
  assert.doesNotMatch(productionWorkflow, /docs\/production-evidence|git checkout -B|gh pr create/);
});
