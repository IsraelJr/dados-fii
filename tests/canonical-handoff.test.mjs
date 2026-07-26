import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const HANDOFF = "DADOS_FII_HANDOFF.md";
const CLOSURE_EVIDENCE = "docs/production-evidence/risk-lab/phase-3-production-closure.json";
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function body() {
  return readFileSync(HANDOFF, "utf8");
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

test("Handoff possui versão, data, base e próxima unidade vigentes", () => {
  const text = body();
  assert.equal(text.split(/\r?\n/, 1)[0], EXACT_FIRST_LINE);
  assert.match(text, /\*\*Versão:\*\* 6\.14\.0/);
  assert.match(text, /\*\*Data:\*\* 26\/07\/2026/);
  assert.match(text, /\*\*Base funcional auditada:\*\* `a3b4f2c010fba3e62e52ed50b8fcacf2706474d2`/);
  assert.match(text, /\*\*Estado da Fase 3:\*\* formalmente concluída/);
  assert.match(text, /\*\*Próxima unidade de trabalho:\*\* 4\.1 — Radar Core/);
});

test("Handoff contém as doze seções obrigatórias na ordem", () => {
  const text = body();
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
    const current = text.indexOf(heading);
    assert.ok(current > previous, heading + " deve existir e respeitar a ordem");
    previous = current;
  }
});

test("Fase 3 está formalmente concluída com produção e double check", () => {
  const text = body();
  for (const required of [
    "Fase 3 — Risk Lab: formalmente concluída",
    "A Fase 3 está formalmente concluída",
    "Vercel=success",
    "Risk Lab Premium Production Gate=success",
    "workflow run: `30219287742`",
    "ENABLE_RISK_LAB_PREMIUM_READONLY=true",
    "feature flag fail-closed no código",
    "notificações: `false`",
    "efeitos externos: `false`",
    "Nenhuma ação manual do usuário é necessária",
  ]) {
    assert.match(text, new RegExp(escapeRegExp(required), "i"));
  }
  assert.doesNotMatch(text, /Estado da Fase 3:\*\* (?:bloqueada|pendente)/i);
  assert.doesNotMatch(text, /Não existem bloqueadores técnicos remanescentes para a Fase 3\.\s*[\s\S]*?bloqueadores de conclusão/i);
});

test("evidência canônica da fase 3.5-C permanece registrada sem maquiar desempenho", () => {
  const text = body();
  for (const required of [
    "merge `ef0c621f2f813009fdb3999b721e4f4a6568c134`",
    "observações consolidadas: `318`",
    "`f18f61b7ddb5cc63955fa9791c6e5e3e43552134aaa28a9dd622a96ee587fcae`",
    "`4b0ced4e8ef662a23317e850353209b72804745be3afa7dc128e05356b2e7c6f`",
    "`edb90face1dddff390dcbf260cf60dc0bb3c053f20ea4ea5a17a0788b98c308e`",
    "KNSC11 falso positivo",
    "MCCI11 inconclusivo",
    "falsos negativos: `0`",
    "calibração obrigatória: `true`",
    "homologação permitida: `false`",
    "Premium integrado: `false`",
    "notificações enviadas: `false`",
  ]) {
    assert.match(text, new RegExp(escapeRegExp(required), "i"));
  }
});

test("evidência canônica da Sprint 3.6 permanece registrada", () => {
  const text = body();
  for (const required of [
    "merge `bfdc186057652a535025d19beae061856624d5c1`",
    "ruleset homologado `0.2.0`",
    "recuperação `89%`",
    "falsos positivos `0`",
    "falsos negativos `0`",
    "MCCI11: `inconclusive_unscored`",
    "`91bf016c119ebbc929409c28f08a751ec4bcc6cb4f6f344656cfa7ef6818a4ec`",
    "`22b84180531f3687c9b3ebeb691020e75e6cb608777276061997b734090d701a`",
    "`35dd492e433855e50849cba05990bb9c5255be6f209fbcce5d5a9cb832ef0017`",
  ]) {
    assert.match(text, new RegExp(escapeRegExp(required), "i"));
  }
});

test("cadeia de integração, rollout e produção da Sprint 3.7 está registrada", () => {
  const text = body();
  for (const required of [
    "merge funcional `7391791b09b1615a86e29c2002b74f95f55e833e`",
    "`982b1c9911610eb58ad6e0af5ea6ed801063c2b9f80783a5ee9c0b45b6de9ac9`",
    "`de2d1abd481e2a66b296dc7eab667277cc8072c807872f9f7b3982da8aa9bbcd`",
    "premium-fund-analysis-v3",
    "premium-manager-mode-v3",
    "merge `4577ace58220e3ca800c3f1a89500ff31b7bfcd2`",
    "merge `3062d8c5b568af90733451d1fe973a99637b1a58`",
    "merge `b19b6dda25142814d4e0e0ac72c65a733f8ab3e0`",
    "merge `a3b4f2c010fba3e62e52ed50b8fcacf2706474d2`",
    "conclusão formal: `true`",
  ]) {
    assert.match(text, new RegExp(escapeRegExp(required), "i"));
  }
});

test("evidência final de produção é íntegra e fail-closed", () => {
  assert.equal(existsSync(CLOSURE_EVIDENCE), true);
  const evidence = JSON.parse(readFileSync(CLOSURE_EVIDENCE, "utf8"));
  assert.equal(evidence.status, "formally_completed");
  assert.equal(evidence.auditedRuntimeCommit, "a3b4f2c010fba3e62e52ed50b8fcacf2706474d2");
  assert.equal(evidence.production.state, "success");
  assert.equal(evidence.productionGate.state, "success");
  assert.equal(evidence.productionGate.workflowRunId, 30219287742);
  assert.equal(evidence.productionGate.validatedCommit, evidence.auditedRuntimeCommit);
  assert.equal(evidence.invariants.enabled, true);
  assert.equal(evidence.invariants.mode, "read_only");
  assert.equal(evidence.invariants.registryVersion, "premium-readonly-v1");
  assert.equal(evidence.invariants.rulesetVersion, "0.2.0");
  assert.equal(evidence.invariants.notificationsAllowed, false);
  assert.equal(evidence.invariants.externalEffectsAllowed, false);
  assert.equal(evidence.invariants.featureFlagDefaultInSource, false);
  assert.equal(evidence.invariants.featureFlagEnabledInDeployment, true);
  const mcci = evidence.cohort.find((item) => item.ticker === "MCCI11");
  assert.equal(mcci.disposition, "inconclusive_unscored");
  const { evidenceHash, ...withoutHash } = evidence;
  assert.equal(sha256(`${JSON.stringify(withoutHash, null, 2)}\n`), evidenceHash);
});

test("arquivos e gates permanentes da Fase 3 existem", () => {
  const files = [
    "docs/production-evidence/risk-lab/cohort-phase-c/index.json",
    "docs/production-evidence/risk-lab/cohort-phase-c/registry.json",
    "docs/production-evidence/risk-lab/cohort-phase-c/dataset-index.json",
    "docs/production-evidence/risk-lab/cohort-phase-c/backtest-report.json",
    "docs/production-evidence/risk-lab/cohort-phase-c-manifest.json",
    "docs/production-evidence/risk-lab/calibration-phase-3-6/index.json",
    "docs/production-evidence/risk-lab/calibration-phase-3-6/calibration-report.json",
    "docs/production-evidence/risk-lab/calibration-phase-3-6-manifest.json",
    "docs/production-evidence/risk-lab/premium-readonly-phase-3-7-manifest.json",
    CLOSURE_EVIDENCE,
    "src/lib/risk-lab/RiskLabRulesetV020.ts",
    "src/lib/risk-lab/FrozenCalibrationPhase36.ts",
    "src/lib/risk-lab/RiskLabPremiumReadModel.ts",
    "src/lib/risk-lab/risk-lab-premium-readonly-v1.json",
    "src/app/api/health/risk-lab-premium/route.ts",
    ".github/workflows/risk-lab-premium-production-gate.yml",
    "tests/risk-lab-premium-readonly.test.ts",
    "tests/risk-lab-premium-integration.test.mjs",
    "tests/risk-lab-premium-rollout-config.test.mjs",
  ];
  for (const file of files) assert.equal(existsSync(file), true, file + " deve existir");

  const workflow = readFileSync(".github/workflows/risk-lab.yml", "utf8");
  assert.match(workflow, /Validate immutable cohort dataset and no-look-ahead backtest/);
  assert.match(workflow, /Validate calibrated and homologated Risk Lab ruleset/);
  assert.match(workflow, /Validate Premium read-only integration and Prompt v3/);
});

test("roadmap e regras do Radar permanecem protegidos", () => {
  const text = body();
  for (const required of [
    "4.1 — Radar Core",
    "4.2 — Radar Intelligence",
    "4.3 — Planos, cobrança, entitlements comerciais e canais",
    "ciclo de benefício de 30 dias",
    "plano Grátis: 1 ticker distinto por ciclo",
    "plano Premium: até 10 tickers distintos por ciclo",
    "remover um fundo não devolve o limite consumido",
    "Salvar para depois",
    "Adicionar ao Radar Inteligente",
    "nunca confiar em `isPremium` do navegador",
    "sem alertas automáticos nesta Sprint",
    "limite patrimonial padrão de 3%",
    "SEO pode avançar em paralelo",
  ]) {
    assert.match(text, new RegExp(escapeRegExp(required), "i"));
  }
});

test("critérios globais de arquitetura e encerramento permanecem protegidos", () => {
  const text = body();
  for (const required of [
    "Nenhuma API nova acessa Firestore diretamente",
    "Ausência de dado não vira zero",
    "Maior cotista PJ",
    "Nenhuma regra de fundo contém exceção hardcoded por ticker",
    "Segurança, autorização e entitlements são verificados no servidor",
    "código está em `main`",
    "CI obrigatória está verde no SHA da PR",
    "universo aplicável foi coberto",
    "evidência final está no Git",
    "smoke ou gate de produção comprovou comportamento",
    "Handoff canônico foi atualizado e protegido por teste",
  ]) {
    assert.match(text, new RegExp(escapeRegExp(required), "i"));
  }
});
