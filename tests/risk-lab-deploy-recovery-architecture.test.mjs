import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/risk-lab-cohort-deploy-recovery.yml", "utf8");
const productionWorkflow = readFileSync(".github/workflows/risk-lab-cohort-backtest.yml", "utf8");
const marker = JSON.parse(readFileSync("docs/production-evidence/risk-lab/sprint-3-5-deploy-trigger.json", "utf8"));

function executable(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*#.*$/gm, "");
}

test("recuperação é espaçada, limitada e não exige ação do proprietário", () => {
  assert.match(workflow, /cron:\s*"17 \* \* \* \*"/);
  assert.match(workflow, /maximum_attempts/);
  assert.match(workflow, /current_attempt >= maximum_attempts/);
  assert.match(workflow, /github-actions\[bot\]/);
  assert.match(workflow, /git push origin HEAD:main/);
  assert.match(workflow, /gh workflow run risk-lab-cohort-backtest\.yml --ref main/);
  assert.doesNotMatch(executable(workflow), /approval|approve|manual_document_review|ADMIN_EMAILS/);
});

test("recuperação para ao encontrar evidência final versionada", () => {
  assert.match(workflow, /run_id.*RUN_ID/);
  assert.match(workflow, /status.*passed/);
  assert.match(workflow, /status.*failed/);
  assert.match(workflow, /evidence_hash/);
  assert.match(workflow, /completed=true/);
});

test("marcador possui limite explícito e representa o estado real da recuperação", () => {
  assert.equal(marker.sprint, "3.5");
  assert.equal(marker.runId, "risk-lab-3-5-20260720-v1");
  assert.ok(Number.isInteger(marker.attempt));
  assert.ok(marker.attempt >= 0);
  assert.ok(marker.attempt <= marker.maximumAttempts);
  assert.equal(marker.maximumAttempts, 6);
  assert.equal(typeof marker.completed, "boolean");
  assert.equal(typeof marker.reason, "string");
  assert.ok(marker.reason.length > 0);
});

test("workflow de Produção continua exigindo release exata e evidência completa", () => {
  assert.match(productionWorkflow, /RELEASE_COMMIT:\s*\$\{\{ github\.sha \}\}/);
  assert.match(productionWorkflow, /release.*RELEASE_COMMIT/);
  assert.match(productionWorkflow, /evidence\.cases \| length == 6/);
  assert.match(productionWorkflow, /premiumIntegrated == false/);
  assert.match(productionWorkflow, /notificationsSent == false/);
});

test("push do marcador também dispara Produção sem depender apenas do dispatch encadeado", () => {
  assert.match(
    productionWorkflow,
    /docs\/production-evidence\/risk-lab\/sprint-3-5-deploy-trigger\.json/,
  );
});
