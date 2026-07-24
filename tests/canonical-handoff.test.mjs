import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const HANDOFF = "DADOS_FII_HANDOFF.md";
const FIRST_LINE = "Este documento substitui todos os planejamentos anteriores quando houver divergência.";

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

test("existe somente um Handoff canônico do Dados FII no Git", () => {
  const matches = walk(ROOT)
    .filter((file) => /(?:^|\/)DADOS_FII_HANDOFF(?:_v[^/]*)?\.md$/i.test(file))
    .sort();
  assert.deepEqual(matches, [HANDOFF]);
});

test("Handoff possui identidade, versão e data vigentes", () => {
  const body = readFileSync(HANDOFF, "utf8");
  assert.equal(body.split(/\r?\n/, 1)[0], FIRST_LINE);
  assert.match(body, /\*\*Versão:\*\* 6\.5\.0/);
  assert.match(body, /\*\*Data:\*\* 24\/07\/2026/);
  assert.match(body, /existe apenas um Handoff canônico versionado no repositório/);
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

test("estado canônico preserva DEVA11 concluído e VSLH11 como próxima unidade", () => {
  const body = readFileSync(HANDOFF, "utf8");
  assert.match(body, /Fase 3\.5-A — DEVA11 está formalmente concluída/);
  assert.match(body, /3\.5-B1 — VSLH11: próxima, não iniciada/);
  assert.match(body, /85\/85 documentos/);
  assert.match(body, /zero pendências/);
  assert.match(body, /zero conflitos/);
  assert.match(body, /498654f03ce66bd54598d5a4677c18bbe5bbdc86/);
});

test("roadmap inclui SEO, Premium v3, Radar e diferenciais competitivos", () => {
  const body = readFileSync(HANDOFF, "utf8");
  assert.match(body, /SEO-S1 — Dias 1–15/);
  assert.match(body, /3\.7 — Risk Lab read-only no Premium \+ Prompt Premium v3/);
  assert.match(body, /4\.1 — Radar: acompanhar fundo fora da carteira/);
  assert.match(body, /Grátis: até 1 fundo/);
  assert.match(body, /Premium: até 10 fundos/);
  for (const capability of [
    "Inteligência documental acionável",
    "Motor de risco e atribuição",
    "Ledger histórico verdadeiro",
    "Screener quantitativo",
    "Fair value e sustentabilidade da renda",
  ]) assert.match(body, new RegExp(capability));
});

test("fontes estratégicas foram versionadas e imagens permanecem tratadas honestamente", () => {
  const body = readFileSync(HANDOFF, "utf8");
  for (const file of [
    "docs/strategy/PLANO_SEO_90_DIAS_DADOS_FII.md",
    "docs/sources/premium-prompt/REFERENCIAS_PROMPT_PREMIUM_FII.md",
    "docs/sources/premium-prompt/README.md",
  ]) assert.equal(existsSync(file), true, `${file} deve existir`);
  assert.match(body, /PLANO_SEO_90_DIAS_DADOS_FII\.md/);
  assert.match(body, /REFERENCIAS_PROMPT_PREMIUM_FII\.md/);
  assert.match(body, /nove (?:imagens|referências)/);
});

test("decisões abertas e critérios universais impedem conclusão prematura", () => {
  const body = readFileSync(HANDOFF, "utf8");
  assert.match(body, /Telegram permanece adiado; WhatsApp continua aberto/);
  assert.match(body, /mensal\/anual, trial, cupom, cobrança/i);
  for (const required of [
    "código está em `main`",
    "CI obrigatória está verde",
    "universo aplicável foi coberto",
    "correções são globais e testadas",
    "evidência final está no Git",
    "issue da fase só é encerrada após auditoria",
  ]) assert.match(body, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
