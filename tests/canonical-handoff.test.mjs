import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const HANDOFF = "DADOS_FII_HANDOFF.md";
const FINAL_EVIDENCE = "docs/production-evidence/risk-lab/phase-3-final-closure.json";
const RELEASE_COMMIT = "a3b4f2c010fba3e62e52ed50b8fcacf2706474d2";
const EXACT_FIRST_LINE = "Este documento substitui todos os planejamentos anteriores quando houver divergência.";

function walk(directory, output = []) {
  for (const entry of readdirSync(directory)) {
    if ([".git", "node_modules", ".next", ".vercel"].includes(entry)) continue;
    const absolute = path.join(directory, entry);
    const relative = path.relative(ROOT, absolute).replaceAll(path.sep, "/");
    const info = statSync(absolute);
    if (info.isDirectory()) walk(absolute, output);
    else output.push(relative);
  }
  return output;
}

function text(file = HANDOFF) {
  return readFileSync(file, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

test("existe somente um Handoff canônico", () => {
  const matches = walk(ROOT)
    .filter((file) => /(?:^|\/)DADOS_FII_HANDOFF(?:_v[^/]*)?\.md$/i.test(file))
    .sort();
  assert.deepEqual(matches, [HANDOFF]);
});

test("Handoff registra a conclusão formal da Fase 3 e a próxima unidade", () => {
  const body = text();
  assert.equal(body.split(/\r?\n/, 1)[0], EXACT_FIRST_LINE);
  assert.match(body, /\*\*Versão:\*\* 6\.14\.0/);
  assert.match(body, /\*\*Data:\*\* 26\/07\/2026/);
  assert.match(body, new RegExp(`\\*\\*Base funcional auditada:\\*\\* \`${RELEASE_COMMIT}\``));
  assert.match(body, /\*\*Estado da Fase 3:\*\* formalmente concluída/);
  assert.match(body, /Próxima unidade de trabalho:\*\* SEO-S1/);
  assert.match(body, /próxima fase funcional: 4\.1 — Radar\/Acompanhar fundo/);
  assert.doesNotMatch(body, /aguardando deployment|bloqueada por quota|conclusão formal pendente/i);
});

test("Handoff contém as doze seções obrigatórias na ordem", () => {
  const body = text();
  const headings = [
    "## 1. Estado atual do projeto",
    "## 2. Fases concluídas",
    "## 3. Sprint atual",
    "## 4. Ordem oficial das próximas sprints",
    "## 5. Escopo e critérios de aceite de cada sprint",
    "## 6. Regras arquiteturais obrigatórias",
    "## 7. Arquivos, branches, commits e PRs existentes",
    "## 8. Funcionalidades concluídas, parciais e pendentes",
    "## 9. Decisões de segurança",
    "## 10. Variáveis de ambiente",
    "## 11. Testes obrigatórios",
    "## 12. Pendências e decisões ainda abertas",
  ];
  let previous = -1;
  for (const heading of headings) {
    const current = body.indexOf(heading);
    assert.ok(current > previous, `${heading} deve existir e respeitar a ordem`);
    previous = current;
  }
});

test("evidência final da Fase 3 é íntegra, completa e conservadora", () => {
  assert.equal(existsSync(FINAL_EVIDENCE), true);
  const evidence = JSON.parse(text(FINAL_EVIDENCE));
  const evidenceHash = evidence.evidenceHash;
  delete evidence.evidenceHash;
  assert.equal(sha256(`${JSON.stringify(evidence, null, 2)}\n`), evidenceHash);

  assert.equal(evidence.status, "formally_completed");
  assert.equal(evidence.phase, "3");
  assert.equal(evidence.sprint, "3.7");
  assert.equal(evidence.releaseCommit, RELEASE_COMMIT);
  assert.equal(evidence.deployment.state, "success");
  assert.equal(evidence.productionGate.context, "Risk Lab Premium Production Gate");
  assert.equal(evidence.productionGate.state, "success");
  assert.equal(evidence.productionGate.runId, 30219287742);
  assert.equal(evidence.ruleset.version, "0.2.0");
  assert.equal(evidence.ruleset.registryVersion, "premium-readonly-v1");
  assert.equal(evidence.invariants.readOnly, true);
  assert.equal(evidence.invariants.notificationsAllowed, false);
  assert.equal(evidence.invariants.externalEffectsAllowed, false);
  assert.equal(evidence.invariants.outsideCohort, "explicit_unavailable");
  assert.equal(evidence.invariants.inconclusive, "preserve_unscored");
  assert.deepEqual(evidence.cohort.inconclusiveUnscored, ["MCCI11"]);
  assert.equal(evidence.cohort.falsePositives, 0);
  assert.equal(evidence.cohort.falseNegatives, 0);
  assert.equal(evidence.gates.reviewThreadsOpen, 0);
  assert.equal(evidence.rollback.codeDefault, false);
});

test("Handoff preserva os fatos e hashes homologados da Fase 3", () => {
  const body = text();
  for (const required of [
    "318 observações",
    "acurácia: `100%`",
    "cobertura: `83,33%`",
    "falsos positivos: `0`",
    "falsos negativos: `0`",
    "MCCI11: `inconclusive_unscored`",
    "ruleset `0.2.0`",
    "premium-readonly-v1",
    "a3b4f2c010fba3e62e52ed50b8fcacf2706474d2",
    "Risk Lab Premium Production Gate",
    "30219287742",
  ]) {
    assert.ok(body.includes(required), required);
  }

  const evidence = JSON.parse(text(FINAL_EVIDENCE));
  assert.equal(evidence.ruleset.datasetHash, "f18f61b7ddb5cc63955fa9791c6e5e3e43552134aaa28a9dd622a96ee587fcae");
  assert.equal(evidence.ruleset.calibrationReportHash, "22b84180531f3687c9b3ebeb691020e75e6cb608777276061997b734090d701a");
  assert.equal(evidence.ruleset.calibrationEvidenceHash, "fd695ecf4cbc759f9953ddcaf15ef14f28ba43a0b3d74098dd5cd1938baa9c81");
  assert.equal(evidence.ruleset.calibrationIndexHash, "35dd492e433855e50849cba05990bb9c5255be6f209fbcce5d5a9cb832ef0017");
});

test("arquivos e gates permanentes da Fase 3 existem", () => {
  const files = [
    "docs/production-evidence/risk-lab/cohort-phase-c/index.json",
    "docs/production-evidence/risk-lab/cohort-phase-c/registry.json",
    "docs/production-evidence/risk-lab/cohort-phase-c/dataset-index.json",
    "docs/production-evidence/risk-lab/cohort-phase-c/backtest-report.json",
    "docs/production-evidence/risk-lab/cohort-phase-c-manifest.json",
    "docs/production-evidence/risk-lab/calibration-phase-3-6/calibration-report.json",
    "docs/production-evidence/risk-lab/calibration-phase-3-6-manifest.json",
    "docs/production-evidence/risk-lab/premium-readonly-phase-3-7-manifest.json",
    FINAL_EVIDENCE,
    "src/lib/risk-lab/RiskLabRulesetV020.ts",
    "src/lib/risk-lab/RiskLabPremiumReadModel.ts",
    "src/lib/risk-lab/risk-lab-premium-readonly-v1.json",
    "src/app/api/health/risk-lab-premium/route.ts",
    ".github/workflows/risk-lab.yml",
    ".github/workflows/risk-lab-premium-production-gate.yml",
    "tests/risk-lab-premium-readonly.test.ts",
    "tests/risk-lab-premium-integration.test.mjs",
    "tests/risk-lab-premium-rollout-config.test.mjs",
  ];
  for (const file of files) {
    assert.equal(existsSync(file), true, `${file} deve existir`);
  }

  const workflow = text(".github/workflows/risk-lab.yml");
  assert.match(workflow, /Validate immutable cohort dataset and no-look-ahead backtest/);
  assert.match(workflow, /Validate calibrated and homologated Risk Lab ruleset/);
  assert.match(workflow, /Validate Premium read-only integration and Prompt v3/);
});

test("gate de produção permanece reativo, auditável e sem polling", () => {
  const workflow = text(".github/workflows/risk-lab-premium-production-gate.yml");
  for (const required of [
    "github.event.context == 'Vercel'",
    "github.event.state == 'success'",
    "contains(github.event.branches.*.name, 'main')",
    "payload.deploymentCommit === expectedCommit",
    "payload.enabled === true",
    "payload.mode === \"read_only\"",
    "payload.rulesetVersion === \"0.2.0\"",
    "payload.notificationsAllowed === false",
    "payload.externalEffectsAllowed === false",
    "statuses: write",
    "Risk Lab Premium Production Gate",
  ]) {
    assert.ok(workflow.includes(required), required);
  }
  assert.doesNotMatch(workflow, /\bsleep\s+\d+|\$\(seq\b|while\s+(true|:)|git\s+(commit|push)|gh\s+pr/i);
});

test("roadmap, segurança e critérios globais permanecem protegidos", () => {
  const body = text();
  for (const required of [
    "SEO-S1 — dias 1–15",
    "Fase 4.1 — Radar/Acompanhar fundo",
    "Grátis acompanha até 1 fundo",
    "Premium acompanha até 10 fundos",
    "GitHub Actions não é fila, banco, cron de aplicação ou mecanismo de polling",
    "Ausência de dado permanece `null`; não vira zero",
    "IA recebe fatos determinísticos e não recalcula score nem preenche lacunas",
    "Risk Lab não envia notificações nem altera carteira",
    "ENABLE_RISK_LAB_PREMIUM_READONLY=false",
    "código está em `main`",
    "evidência final está no Git",
    "issue foi encerrada após auditoria",
  ]) {
    assert.ok(body.includes(required), required);
  }
});
