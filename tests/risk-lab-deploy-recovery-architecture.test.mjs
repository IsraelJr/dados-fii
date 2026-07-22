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

test("recuperação só aceita evidência final da release atualmente implantável", () => {
  assert.match(workflow, /risk-lab-3-5-20260720-v2/);
  assert.match(workflow, /current_release=\$\(git rev-parse HEAD\)/);
  assert.match(workflow, /run_id.*RUN_ID/);
  assert.match(workflow, /release.*current_release/);
  assert.match(workflow, /status.*passed/);
  assert.match(workflow, /status.*failed/);
  assert.match(workflow, /evidence_hash/);
  assert.match(workflow, /completed=true/);
});

test("orçamento de tentativas reinicia automaticamente quando o SHA alvo muda", () => {
  assert.match(workflow, /marker_release=.*targetRelease/);
  assert.match(workflow, /marker_release.*current_release/);
  assert.match(workflow, /current_attempt=0/);
  assert.match(workflow, /\.targetRelease = \$targetRelease/);
  assert.match(workflow, /\.schemaVersion = 3/);
});

test("marcador v3 possui release alvo e limite explícito", () => {
  assert.equal(marker.schemaVersion, 3);
  assert.equal(marker.sprint, "3.5");
  assert.equal(marker.runId, "risk-lab-3-5-20260720-v2");
  assert.match(marker.targetRelease, /^[a-f0-9]{40}$/);
  assert.ok(Number.isInteger(marker.attempt));
  assert.ok(marker.attempt >= 0);
  assert.ok(marker.attempt <= marker.maximumAttempts);
  assert.equal(marker.maximumAttempts, 6);
  assert.equal(typeof marker.completed, "boolean");
  assert.equal(typeof marker.reason, "string");
  assert.ok(marker.reason.length > 0);
});

test("workflow de Produção exige release exata e evidência metodológica completa", () => {
  assert.match(productionWorkflow, /RELEASE_COMMIT:\s*\$\{\{ github\.sha \}\}/);
  assert.match(productionWorkflow, /release.*RELEASE_COMMIT/);
  assert.match(productionWorkflow, /schemaVersion == 2/);
  assert.match(productionWorkflow, /methodologyVersion == "2\.0\.0"/);
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
