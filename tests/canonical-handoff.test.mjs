import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const HANDOFF = "DADOS_FII_HANDOFF.md";
const EXACT_FIRST_LINE =
  "Este documento substitui todos os planejamentos anteriores quando houver divergência.";

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

test("existe somente um Handoff canônico do Dados FII no Git", () => {
  const matches = walk(ROOT)
    .filter((file) => /(?:^|\/)DADOS_FII_HANDOFF(?:_v[^/]*)?\.md$/i.test(file))
    .sort();
  assert.deepEqual(matches, [HANDOFF]);
});

test("Handoff possui precedência, versão e data vigentes", () => {
  const body = readFileSync(HANDOFF, "utf8");
  assert.equal(body.split(/\r?\n/, 1)[0], EXACT_FIRST_LINE);
  assert.match(body, /\*\*Versão:\*\* 6\.7\.0/);
  assert.match(body, /\*\*Data:\*\* 24\/07\/2026/);
  assert.match(body, /existe apenas um Handoff canônico versionado no repositório/i);
});

test("Handoff contém as doze seções obrigatórias na ordem", () => {
  const body = readFileSync(HANDOFF, "utf8");
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

test("estado canônico mantém três fundos concluídos e KNSC11 como próxima fase", () => {
  const body = readFileSync(HANDOFF, "utf8");
  assert.match(body, /Fase 3\.5-A — DEVA11 está formalmente concluída/);
  assert.match(body, /Fase 3\.5-B1 — VSLH11 está formalmente concluída/);
  assert.match(body, /Fase 3\.5-B2 — KNCR11 está formalmente concluída/);
  assert.match(body, /Próxima unidade de trabalho:\*\* 3\.5-B3 — KNSC11/);
  assert.match(body, /documentos descobertos\/classificados: `85\/85`/);
  assert.match(body, /documentos descobertos\/classificados: `79\/79`/);
  assert.match(body, /documentos descobertos\/classificados: `52\/52`/);
  assert.match(body, /merge funcional: `52c02e41a64a09eaa6d6649c30cd6ddb8f9fb693`/);
  assert.match(body, /índice de evidência: `c11de46d43de21e98a3eb6986a8fb5c0692465672c412b3329f20d86a9bfd1bb`/);
  assert.match(body, /3\.5-B3 — KNSC11: próxima, não iniciada/);
});

test("roadmap inclui SEO, Premium v3, Radar e diferenciais estratégicos", () => {
  const body = readFileSync(HANDOFF, "utf8");
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
  ]) assert.match(body, new RegExp(escapeRegExp(required), "i"));
});

test("fontes estratégicas e evidências dos três fundos estão versionadas", () => {
  const sourceFiles = [
    "docs/strategy/PLANO_SEO_90_DIAS_DADOS_FII.md",
    "docs/sources/premium-prompt/REFERENCIAS_PROMPT_PREMIUM_FII.md",
    "docs/sources/premium-prompt/README.md",
    "docs/production-evidence/risk-lab/vslh11-phase-b1/index.json",
    "docs/production-evidence/risk-lab/kncr11-phase-b2-manifest.json",
    "docs/production-evidence/risk-lab/kncr11-phase-b2/index.json",
    "docs/risk-lab/sprint-3-5-b2-kncr11.md",
    "tests/risk-lab-kncr11-evidence.test.mjs",
  ];
  for (const sourceFile of sourceFiles) {
    assert.equal(existsSync(sourceFile), true, `${sourceFile} deve existir`);
  }
  const visualReadme = readFileSync(sourceFiles[2], "utf8");
  assert.match(visualReadme, /não estavam acessíveis como binários/i);
  assert.match(visualReadme, /nenhum hash foi inventado/i);
});

test("critérios de conclusão impedem certificação sem evidência global", () => {
  const body = readFileSync(HANDOFF, "utf8");
  for (const required of [
    "código está em `main`",
    "CI obrigatória está verde no SHA da PR",
    "universo aplicável foi coberto",
    "correções são globais e testadas",
    "evidência final está no Git",
    "issue da fase só é encerrada após auditoria da `main`",
  ]) assert.match(body, new RegExp(escapeRegExp(required)));
});
