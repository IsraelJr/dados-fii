import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const HANDOFF = "DADOS_FII_HANDOFF.md";
const HISTORICAL_EVIDENCE = "docs/production-evidence/risk-lab/phase-3-final-closure.json";
const PRODUCT_DIRECTION = "docs/product/product-validation-phase-1.md";
const EXACT_FIRST_LINE = "Este documento substitui todos os planejamentos anteriores quando houver divergência.";

function walk(directory, output = []) {
  for (const entry of readdirSync(directory)) {
    if ([".git", "node_modules", ".next", ".vercel", "playwright-report", "test-results"].includes(entry)) continue;
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

function requireAll(body, values) {
  for (const value of values) assert.ok(body.includes(value), `conteúdo canônico ausente: ${value}`);
}

test("existe somente um Handoff canônico ativo", () => {
  const matches = walk(ROOT)
    .filter((file) => /handoff.*\.md$/i.test(path.basename(file)))
    .filter((file) => !file.startsWith("tests/fixtures/"))
    .sort();
  assert.deepEqual(matches, [HANDOFF]);
});

test("Handoff identifica a fase, sprint e governança vigentes", () => {
  const body = text();
  assert.equal(body.split(/\r?\n/, 1)[0], EXACT_FIRST_LINE);
  assert.match(body, /\*\*Versão:\*\* 10\.\d+\.\d+/);
  requireAll(body, [
    "Produto Validável",
    "PV-1 — Jornada principal da carteira e histórico manual",
    "agent/product-validation-phase-1",
    "#154",
    "#155",
    "Google AdSense está congelado",
    "histórico manual do ano corrente será gratuito e sem propaganda",
  ]);
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

test("PV-1 mantém regras críticas de integridade e conclusão", () => {
  const body = text();
  requireAll(body, [
    "cadastro/login → carteira → persistência → histórico → diagnóstico",
    "proveniência: `manual`, `automatic_snapshot` ou `legacy`",
    "impedir duplicidade por usuário e competência",
    "não sobrescrever conflito silenciosamente",
    "isolamento entre usuários comprovado",
    "Nenhum `route.ts` importa Firestore diretamente",
    "Logs e telemetria não contêm valores financeiros",
    "CI é gate de merge e deploy",
    "Nenhuma validação manual do usuário substitui essa obrigação",
  ]);
});

test("documento de direção da nova fase existe", () => {
  assert.equal(existsSync(PRODUCT_DIRECTION), true);
  requireAll(text(PRODUCT_DIRECTION), ["Produto Validável", "PV-1", "Google AdSense"]);
});

test("evidência histórica permanece íntegra", () => {
  assert.equal(existsSync(HISTORICAL_EVIDENCE), true);
  const evidence = JSON.parse(text(HISTORICAL_EVIDENCE));
  const evidenceHash = evidence.evidenceHash;
  delete evidence.evidenceHash;
  assert.equal(sha256(`${JSON.stringify(evidence, null, 2)}\n`), evidenceHash);
  assert.equal(evidence.releaseCommit, "a3b4f2c010fba3e62e52ed50b8fcacf2706474d2");
  assert.equal(evidence.ruleset.version, "0.2.0");
  assert.equal(evidence.invariants.readOnly, true);
  assert.equal(evidence.invariants.notificationsAllowed, false);
  assert.equal(evidence.invariants.externalEffectsAllowed, false);
});

test("pipeline mantém gates bloqueantes", () => {
  const workflow = text(".github/workflows/phase-2-closure.yml");
  requireAll(workflow, [
    "npm ci",
    "npm run audit:production",
    "npm run security:secrets",
    "npm run lint",
    "npm run typecheck",
    "npm run test:all",
    "npm run test:rules",
    "npm run test:coverage:critical",
    "npm run test:mutation",
    "npm run build",
    "npm run test:http",
    "npm run test:e2e",
  ]);
});

test("manifesto de regressão mantém DEF-01 a DEF-22 vinculados", () => {
  const testSources = walk(path.join(ROOT, "tests"))
    .filter((file) => /\.test\.(?:ts|mjs)$/.test(file))
    .map((file) => text(file))
    .join("\n");
  for (let number = 1; number <= 22; number += 1) {
    const id = `REG-DEF-${String(number).padStart(2, "0")}`;
    assert.ok(testSources.includes(id), `${id} deve permanecer vinculado a uma regressão`);
  }
  assert.match(testSources, /REG-DEF-03-A/);
  assert.match(testSources, /REG-DEF-03-B/);
});
