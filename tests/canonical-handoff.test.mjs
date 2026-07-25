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

test("existe somente um Handoff canônico do Dados FII", () => {
  const matches = walk(ROOT).filter((file) => /(?:^|\/)DADOS_FII_HANDOFF(?:_v[^/]*)?\.md$/i.test(file)).sort();
  assert.deepEqual(matches, [HANDOFF]);
});

test("Handoff possui precedência, versão, data e base funcional vigentes", () => {
  const text = body();
  assert.equal(text.split(/\r?\n/, 1)[0], EXACT_FIRST_LINE);
  assert.match(text, /\*\*Versão:\*\* 6\.10\.0/);
  assert.match(text, /\*\*Data:\*\* 24\/07\/2026/);
  assert.match(text, /\*\*Base funcional auditada:\*\* `c616437a0a44c1543015a709911c67f70f390b7d`/);
  assert.match(text, /existe apenas um Handoff canônico versionado no repositório/i);
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
    assert.ok(current > previous, `${heading} deve existir e respeitar a ordem`);
    previous = current;
  }
});

test("os seis fundos estão formalmente concluídos e 3.5-C é a próxima unidade", () => {
  const text = body();
  for (const required of [
    "Fase 3.5-A — DEVA11 está formalmente concluída",
    "Fase 3.5-B1 — VSLH11 está formalmente concluída",
    "Fase 3.5-B2 — KNCR11 está formalmente concluída",
    "Fase 3.5-B3 — KNSC11 está formalmente concluída",
    "Fase 3.5-B4 — MCCI11 está formalmente concluída",
    "Fase 3.5-B5 — RBRY11 está formalmente concluída",
    "Os seis fundos da coorte externa estão formalmente concluídos",
    "Próxima unidade de trabalho:** 3.5-C — dataset final e backtest externo sem informação futura",
    "Sprint 3.5 completa permanece aberta porque dataset e backtest ainda não foram executados",
  ]) assert.match(text, new RegExp(escapeRegExp(required), "i"));
  assert.doesNotMatch(text, /MCCI11 e RBRY11\.\n- Dataset final/);
});

test("evidência canônica do MCCI11 está registrada", () => {
  const text = body();
  assert.match(text, /merge funcional: `d2000807cc51f66288491ccf715f7ed84ab63fb2`/);
  assert.match(text, /documentos descobertos\/classificados: `48\/48`/);
  assert.match(text, /lacuna explícita: `2025-02`/);
  assert.match(text, /índice de evidência: `14c6ad2e55053d020688c0c99252e35a45c91a748cd946fd403b9acd0d99a817`/);
});

test("evidência canônica do RBRY11 está registrada", () => {
  const text = body();
  assert.match(text, /merge funcional: `c616437a0a44c1543015a709911c67f70f390b7d`/);
  assert.match(text, /documentos descobertos\/classificados: `54\/54`/);
  assert.match(text, /competências selecionadas: `47`, contínuas de `2022-01` a `2025-11`/);
  assert.match(text, /recuperação oficial: `987180`, competência `2025-08`, R\$ 1,25 por cota/);
  assert.match(text, /índice de evidência: `938b856f5a74edcd404b494f68a33654c1f68b4ae01a392de56e6cbc5c741ed1`/);
});

test("evidências dos seis fundos e testes permanentes estão versionados", () => {
  const files = [
    "docs/production-evidence/risk-lab/deva11-phase-a/index.json",
    "docs/production-evidence/risk-lab/vslh11-phase-b1/index.json",
    "docs/production-evidence/risk-lab/kncr11-phase-b2/index.json",
    "docs/production-evidence/risk-lab/knsc11-phase-b3/index.json",
    "docs/production-evidence/risk-lab/mcci11-phase-b4/index.json",
    "docs/production-evidence/risk-lab/rbry11-phase-b5/index.json",
    "docs/risk-lab/sprint-3-5-b4-mcci11.md",
    "docs/risk-lab/sprint-3-5-b5-rbry11.md",
    "src/lib/risk-lab/FrozenDividendRetryCheckpointAuditor.ts",
    "tests/risk-lab-mcci11-evidence.test.mjs",
    "tests/risk-lab-rbry11-evidence.test.mjs",
  ];
  for (const file of files) assert.equal(existsSync(file), true, `${file} deve existir`);
  assert.equal(existsSync(".github/workflows/risk-lab-rbry11-retry.yml"), false);
  assert.equal(existsSync("scripts/risk-lab-retry-rbry11.mjs"), false);
});

test("roadmap estratégico e bloqueios de produto permanecem preservados", () => {
  const text = body();
  for (const required of [
    "SEO-S1, dias 1–15",
    "3.7 — Risk Lab read-only no Premium + Prompt Premium v3",
    "4.1 — Radar: acompanhar fundo fora da carteira",
    "Grátis até 1",
    "Premium até 10",
    "Inteligência documental",
    "Carteira histórica verdadeira",
    "Screener quantitativo",
    "Fair value e sustentabilidade da renda",
    "Risk Lab permanece fora do Premium e das notificações até 3.5/3.6",
  ]) assert.match(text, new RegExp(escapeRegExp(required), "i"));
});

test("fallback de deployment não mascara mudança de runtime", () => {
  const text = body();
  for (const required of [
    "fallback de build só é válido quando o diff não altera código de produto",
    "Se o diff alterar código de runtime, build local/CI não substitui Preview ou deployment real",
    "credenciais descartáveis no runner",
  ]) assert.match(text, new RegExp(escapeRegExp(required), "i"));
});

test("critérios globais de conclusão continuam obrigatórios", () => {
  const text = body();
  for (const required of [
    "código está em `main`",
    "CI obrigatória está verde no SHA da PR",
    "universo aplicável foi coberto",
    "correções são globais e testadas",
    "evidência final está no Git",
    "issue da fase só é encerrada após auditoria da `main`",
    "Handoff canônico foi atualizado e protegido por teste",
  ]) assert.match(text, new RegExp(escapeRegExp(required)));
});
