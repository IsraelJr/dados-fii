import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(".github/workflows/risk-lab-cohort-backtest.yml", "utf8");

function executable(source) {
  return source.replace(/^\s*#.*$/gm, "");
}

test("formalização publica a branch antes de tentar criar a PR", () => {
  const publish = workflow.indexOf("name: Publish immutable evidence branch");
  const createPr = workflow.indexOf("name: Create evidence pull request");
  assert.ok(publish >= 0);
  assert.ok(createPr > publish);
  assert.match(workflow, /git push --force-with-lease origin "HEAD:\$\{EVIDENCE_BRANCH\}"/);
  assert.match(workflow, /gh pr create --base main --head "\$EVIDENCE_BRANCH"/);
});

test("branch de evidência é única por execução e tentativa", () => {
  assert.match(workflow, /GITHUB_RUN_ID.*GITHUB_RUN_ATTEMPT/);
  assert.match(workflow, /git checkout -B "\$EVIDENCE_BRANCH"/);
  assert.match(workflow, /git add -f "\$EVIDENCE_PATH" "\$SUMMARY_PATH"/);
});

test("blockers mantêm a Sprint aberta somente depois da PR existir", () => {
  const createPr = workflow.indexOf("name: Create evidence pull request");
  const failClosed = workflow.indexOf("name: Keep Sprint open when methodological blockers exist");
  assert.ok(failClosed > createPr);
  assert.match(workflow, /steps\.pull_request\.outcome == 'success'/);
  assert.match(workflow, /steps\.prepare\.outputs\.status != 'passed'/);
  assert.match(workflow, /exit 1/);
});

test("evidência aprovada executa gates locais e merge automático", () => {
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm run test:risk-lab/);
  assert.match(workflow, /npm run test:sprint2/);
  assert.match(workflow, /finalize-risk-lab-sprint-3-5\.mjs/);
  assert.match(workflow, /gh pr merge "\$PR_URL" --squash --delete-branch/);
  assert.match(workflow, /gh pr merge "\$PR_URL" --auto --squash --delete-branch/);
});

test("formalização continua sem aprovação manual ou efeitos externos", () => {
  const source = executable(workflow);
  assert.doesNotMatch(source, /manual_document_review|approve fund|aprovar fundo|sendEmail|sendNotification/);
  assert.match(workflow, /premiumIntegrated == false/);
  assert.match(workflow, /notificationsSent == false/);
});
