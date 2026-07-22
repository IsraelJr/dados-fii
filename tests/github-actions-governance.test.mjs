import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const WORKFLOW_DIR = ".github/workflows";
const POLICY_PATH = "docs/engineering/github-actions-policy.md";
const INVENTORY_PATH = "docs/engineering/github-actions-inventory.md";

function workflowFiles() {
  return readdirSync(WORKFLOW_DIR)
    .filter((file) => /\.ya?ml$/i.test(file))
    .sort();
}

function source(file) {
  return readFileSync(path.join(WORKFLOW_DIR, file), "utf8");
}

function executable(value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*#.*$/gm, "");
}

test("todos os workflows ativos estão inventariados e possuem política oficial", () => {
  assert.equal(existsSync(POLICY_PATH), true, `${POLICY_PATH} deve existir`);
  assert.equal(existsSync(INVENTORY_PATH), true, `${INVENTORY_PATH} deve existir`);
  const inventory = readFileSync(INVENTORY_PATH, "utf8");
  const files = workflowFiles();
  assert.ok(files.length > 0, "ao menos um workflow deve permanecer ativo");
  for (const file of files) {
    assert.equal(inventory.includes(`\`${file}\``), true, `${file} deve constar no inventário`);
  }
});

test("workflows legados, recovery por commit e marcador operacional não retornam", () => {
  for (const legacyPath of [
    ".github/workflows/patch-portfolio-notification-types.yml",
    ".github/workflows/risk-lab-cohort-deploy-recovery.yml",
    "docs/production-evidence/risk-lab/sprint-3-5-deploy-trigger.json",
  ]) {
    assert.equal(existsSync(legacyPath), false, `${legacyPath} deve permanecer removido`);
  }
});

test("nenhum workflow usa Git como fila, mecanismo de retry ou gatilho artificial", () => {
  for (const file of workflowFiles()) {
    const body = executable(source(file));
    assert.doesNotMatch(body, /git\s+push\b/i, `${file} não pode fazer push`);
    assert.doesNotMatch(body, /git\s+commit\b/i, `${file} não pode criar commit operacional`);
    assert.doesNotMatch(body, /gh\s+workflow\s+run\b/i, `${file} não pode iniciar cadeia de workflows`);
    assert.doesNotMatch(body, /gh\s+pr\s+(create|merge)\b/i, `${file} não pode criar ou mesclar PR automaticamente`);
    assert.doesNotMatch(body, /sprint-3-5-deploy-trigger\.json/i, `${file} não pode depender do marcador removido`);
  }
});

test("workflows não fazem polling, sleeps ou retries prolongados", () => {
  for (const file of workflowFiles()) {
    const body = executable(source(file));
    assert.doesNotMatch(body, /\bsleep\s+\d+/i, `${file} não pode manter runner dormindo`);
    assert.doesNotMatch(body, /for\s+\w+\s+in\s+\$\(seq\b/i, `${file} não pode implementar polling por seq`);
    assert.doesNotMatch(body, /while\s+(true|:)/i, `${file} não pode implementar retry ilimitado`);
  }
});

test("todos os jobs têm concorrência cancelável e timeout econômico", () => {
  for (const file of workflowFiles()) {
    const body = source(file);
    assert.match(body, /^concurrency:/m, `${file} deve declarar concurrency`);
    assert.match(body, /cancel-in-progress:\s*true/, `${file} deve cancelar execução substituída`);

    const jobs = [...body.matchAll(/^\s{4}runs-on:/gm)].length;
    const timeoutMatches = [...body.matchAll(/timeout-minutes:\s*(\d+)([^\n]*)/g)];
    assert.equal(timeoutMatches.length, jobs, `${file} deve declarar timeout em cada job`);
    for (const [, rawMinutes, suffix] of timeoutMatches) {
      const minutes = Number(rawMinutes);
      const documentedException = suffix.includes("governance-exception");
      assert.ok(minutes <= (documentedException ? 30 : 20), `${file} excede o timeout permitido`);
    }
  }
});

test("dependências usam lockfile e cache sem npm install mutável", () => {
  for (const file of workflowFiles()) {
    const body = executable(source(file));
    assert.doesNotMatch(body, /\bnpm\s+install\b/i, `${file} deve usar npm ci`);
    if (/\bnpm\s+ci\b/i.test(body)) {
      assert.match(body, /actions\/setup-node@v4/);
      assert.match(body, /cache:\s*npm/);
    }
  }
});

test("permissões de escrita e schedules operacionais ficam fora do GitHub Actions", () => {
  for (const file of workflowFiles()) {
    const body = executable(source(file));
    assert.doesNotMatch(body, /^\s*schedule:/m, `${file} não pode executar cron de aplicação`);
    assert.doesNotMatch(body, /^\s*(contents|actions|pull-requests):\s*write\s*$/m, `${file} não precisa de permissão de escrita`);
  }
});

test("push, quando necessário, é restrito a main e tarefas pesadas são manuais", () => {
  for (const file of workflowFiles()) {
    const body = source(file);
    const hasPush = /^\s{2}push:/m.test(body);
    if (hasPush) assert.match(body, /push:[\s\S]*?branches:\s*(?:\n\s*-\s*main|\[main\])/, `${file} só pode reagir a push em main`);
  }

  for (const heavy of [
    "risk-lab-cohort-backtest.yml",
    "risk-lab-frozen-dividend-notices.yml",
  ]) {
    const body = source(heavy);
    assert.match(body, /^\s{2}workflow_dispatch:/m, `${heavy} deve ser explicitamente manual`);
    assert.doesNotMatch(body, /^\s{2}(push|pull_request|schedule):/m, `${heavy} não pode possuir gatilho automático`);
  }
});

test("artefatos operacionais possuem retenção curta", () => {
  for (const file of workflowFiles()) {
    const body = source(file);
    for (const [, rawDays] of body.matchAll(/retention-days:\s*(\d+)/g)) {
      assert.ok(Number(rawDays) <= 7, `${file} excede retenção operacional de 7 dias`);
    }
  }
});

test("orquestração do backtest ocorre no backend por avanço idempotente", () => {
  const route = readFileSync("src/app/api/admin/system/risk-lab/cohort-backtest/route.ts", "utf8");
  const kickoff = source("risk-lab-cohort-backtest.yml");
  assert.match(route, /"advance"/);
  assert.match(route, /getPublicEvidence\(\)/);
  assert.match(route, /SEGMENTED_COHORT_TICKERS\.find/);
  assert.match(route, /nextAction/);
  assert.doesNotMatch(route, /github-actions|deploy-trigger|git\s+push/i);
  assert.equal((kickoff.match(/curl\b/g) || []).length, 1, "kickoff deve fazer uma única chamada HTTP");
  assert.doesNotMatch(kickoff, /npm\s+(ci|install)|actions\/checkout|sleep|for\s+attempt/i);
});
