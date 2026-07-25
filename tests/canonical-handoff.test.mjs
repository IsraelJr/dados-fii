import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const HANDOFF = "DADOS_FII_HANDOFF.md";
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

test("existe somente um Handoff canônico", () => {
  const matches = walk(ROOT)
    .filter((file) => /(?:^|\/)DADOS_FII_HANDOFF(?:_v[^/]*)?\.md$/i.test(file))
    .sort();
  assert.deepEqual(matches, [HANDOFF]);
});

test("Handoff possui versão, data, base e próxima unidade vigentes", () => {
  const text = body();
  assert.equal(text.split(/\r?\n/, 1)[0], EXACT_FIRST_LINE);
  assert.match(text, /\*\*Versão:\*\* 6\.12\.0/);
  assert.match(text, /\*\*Data:\*\* 25\/07\/2026/);
  assert.match(text, /\*\*Base funcional auditada:\*\* `bfdc186057652a535025d19beae061856624d5c1`/);
  assert.match(text, /Próxima unidade de trabalho:\*\* 3\.7 — Risk Lab read-only no Premium \+ Prompt Premium v3 — não iniciada/);
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

test("Sprints 3.5 e 3.6 estão concluídas e 3.7 não foi iniciada", () => {
  const text = body();
  for (const required of [
    "A Sprint 3.6 está formalmente concluída",
    "Sprint 3.6 completa: formalmente concluída",
    "Sprint 3.7 — Risk Lab read-only no Premium + Prompt Premium v3",
    "Estado: **planejada e não iniciada**",
    "A Sprint 3.7 não foi iniciada automaticamente",
    "ruleset `0.2.0` está homologado",
    "Risk Lab não está integrado ao Premium/notificações",
  ]) {
    assert.match(text, new RegExp(escapeRegExp(required), "i"));
  }
  assert.doesNotMatch(text, /Sprint 3\.6 não está concluída/i);
  assert.doesNotMatch(text, /ruleset `0\.1\.0` não está homologado/i);
});

test("evidência canônica da fase 3.5-C está registrada sem maquiar desempenho", () => {
  const text = body();
  for (const required of [
    "merge funcional: `ef0c621f2f813009fdb3999b721e4f4a6568c134`",
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

test("evidência canônica da Sprint 3.6 está registrada", () => {
  const text = body();
  for (const required of [
    "merge funcional: `bfdc186057652a535025d19beae061856624d5c1`",
    "ruleset homologado: `0.2.0`",
    "recuperação `89%`",
    "falsos positivos `0`",
    "falsos negativos `0`",
    "MCCI11: `inconclusive_unscored`",
    "`91bf016c119ebbc929409c28f08a751ec4bcc6cb4f6f344656cfa7ef6818a4ec`",
    "`22b84180531f3687c9b3ebeb691020e75e6cb608777276061997b734090d701a`",
    "`35dd492e433855e50849cba05990bb9c5255be6f209fbcce5d5a9cb832ef0017`",
    "Premium integrado: `false`",
    "notificações enviadas: `false`",
  ]) {
    assert.match(text, new RegExp(escapeRegExp(required), "i"));
  }
});

test("arquivos e gates permanentes da 3.5-C existem", () => {
  const files = [
    "docs/production-evidence/risk-lab/cohort-phase-c/index.json",
    "docs/production-evidence/risk-lab/cohort-phase-c/registry.json",
    "docs/production-evidence/risk-lab/cohort-phase-c/dataset-index.json",
    "docs/production-evidence/risk-lab/cohort-phase-c/backtest-report.json",
    "docs/production-evidence/risk-lab/cohort-phase-c-manifest.json",
    "docs/risk-lab/sprint-3-5-c-dataset-backtest.md",
    "src/lib/risk-lab/FrozenCohortPhaseC.ts",
    "src/lib/risk-lab/frozen-cohort-phase-c-v1.json",
    "tests/risk-lab-cohort-phase-c-evidence.test.mjs",
    "tests/risk-lab-frozen-cohort-phase-c.test.ts",
    "docs/production-evidence/risk-lab/calibration-phase-3-6/index.json",
    "docs/production-evidence/risk-lab/calibration-phase-3-6/calibration-report.json",
    "docs/production-evidence/risk-lab/calibration-phase-3-6-manifest.json",
    "src/lib/risk-lab/RiskLabRulesetV020.ts",
    "src/lib/risk-lab/FrozenCalibrationPhase36.ts",
    "tests/risk-lab-calibration-phase-3-6.test.ts",
    "tests/risk-lab-calibration-phase-3-6-evidence.test.mjs",
  ];
  for (const file of files) {
    assert.equal(existsSync(file), true, file + " deve existir");
  }
  const workflow = readFileSync(".github/workflows/risk-lab.yml", "utf8");
  assert.match(workflow, /Validate immutable cohort dataset and no-look-ahead backtest/);
  assert.match(workflow, /Validate calibrated and homologated Risk Lab ruleset/);
});

test("roadmap, fallback e critérios globais permanecem protegidos", () => {
  const text = body();
  for (const required of [
    "3.7 — Risk Lab read-only no Premium + Prompt Premium v3",
    "4.1 — Radar: acompanhar fundo fora da carteira",
    "Grátis até 1",
    "Premium até 10",
    "SEO-S1, dias 1–15",
    "código offline do Risk Lab não importado pelo runtime do produto",
    "Se o diff alterar código de runtime, build local/CI não substitui Preview ou deployment real",
    "código está em `main`",
    "CI obrigatória está verde no SHA da PR",
    "universo aplicável foi coberto",
    "evidência final está no Git",
    "Handoff canônico foi atualizado e protegido por teste",
  ]) {
    assert.match(text, new RegExp(escapeRegExp(required), "i"));
  }
});
