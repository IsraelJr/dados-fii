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
  assert.match(body, /\*\*Versão:\*\* 6\.5\.0/);
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

test("estado canônico mantém DEVA11 concluído e VSLH11 como próxima fase", () => {
  const body = readFileSync(HANDOFF, "utf8");

  assert.match(body, /Fase 3\.5-A — DEVA11 está formalmente concluída/);
  assert.match(body, /Próxima unidade de trabalho:\*\* 3\.5-B1 — VSLH11/);
  assert.match(body, /documentos descobertos\/classificados: `85\/85`/);
  assert.match(body, /pendências: `0`/);
  assert.match(body, /conflitos: `0`/);
  assert.match(body, /498654f03ce66bd54598d5a4677c18bbe5bbdc86/);
});

test("roadmap inclui SEO, Premium v3, Radar e limites de acompanhamento", () => {
  const body = readFileSync(HANDOFF, "utf8");

  for (const required of [
    "SEO-S1 — Dias 1–15",
    "3.7 — Risk Lab read-only no Premium + Prompt Premium v3",
    "4.1 — Radar: acompanhar fundo fora da carteira",
    "Grátis: até 1 fundo",
    "Premium: até 10 fundos",
    "Inteligência sobre documentos e “o que mudou”",
    "Carteira histórica verdadeira",
    "Screener quantitativo",
    "Fair value e sustentabilidade da renda",
  ]) {
    assert.match(body, new RegExp(escapeRegExp(required)));
  }
});

test("fontes estratégicas de SEO e Prompt Premium estão versionadas", () => {
  const sourceFiles = [
    "docs/strategy/PLANO_SEO_90_DIAS_DADOS_FII.md",
    "docs/sources/premium-prompt/REFERENCIAS_PROMPT_PREMIUM_FII.md",
    "docs/sources/premium-prompt/README.md",
  ];

  for (const sourceFile of sourceFiles) {
    assert.equal(existsSync(sourceFile), true, `${sourceFile} deve existir`);
  }

  const visualReadme = readFileSync(sourceFiles[2], "utf8");
  assert.match(visualReadme, /binários.*não estavam acessíveis/i);
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
  ]) {
    assert.match(body, new RegExp(escapeRegExp(required)));
  }
});
