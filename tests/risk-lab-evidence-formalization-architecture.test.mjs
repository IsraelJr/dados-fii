import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/risk-lab-cohort-backtest.yml", "utf8");
const policy = readFileSync("docs/engineering/github-actions-policy.md", "utf8");

function executable(source) {
  return source.replace(/^\s*#.*$/gm, "");
}

test("kickoff não cria branch, commit, PR ou merge de evidência", () => {
  const source = executable(workflow);
  assert.doesNotMatch(source, /git\s+(checkout|add|commit|push)/i);
  assert.doesNotMatch(source, /gh\s+pr\s+(create|merge)/i);
  assert.doesNotMatch(source, /contents:\s*write|pull-requests:\s*write/i);
});

test("tentativa intermediária usa summary e artefato curto", () => {
  assert.match(workflow, /GITHUB_STEP_SUMMARY/);
  assert.match(workflow, /actions\/upload-artifact@v4/);
  assert.match(workflow, /retention-days:\s*3/);
  assert.doesNotMatch(workflow, /docs\/production-evidence\/risk-lab/);
});

test("workflow não repete gates já aprovados antes do deploy", () => {
  assert.doesNotMatch(workflow, /npm run typecheck/);
  assert.doesNotMatch(workflow, /npm run test:risk-lab/);
  assert.doesNotMatch(workflow, /npm run test:sprint2/);
  assert.doesNotMatch(workflow, /finalize-risk-lab-sprint-3-5\.mjs/);
});

test("formalizador final continua versionado, mas fora do runner operacional", () => {
  assert.equal(existsSync("scripts/finalize-risk-lab-sprint-3-5.mjs"), true);
  assert.match(policy, /Branch\/PR só é criada para evidência final estável e relevante/);
  assert.match(policy, /Evidência final/);
});

test("fluxo permanece sem aprovação técnica manual ou efeitos externos", () => {
  const source = executable(workflow);
  assert.doesNotMatch(source, /manual_document_review|approve fund|aprovar fundo|sendEmail|sendNotification/);
  assert.match(workflow, /runId/);
  assert.match(workflow, /releaseCommit/);
});
