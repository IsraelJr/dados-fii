import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const HANDOFF = "DADOS_FII_HANDOFF.md";
const HISTORICAL_EVIDENCE = "docs/production-evidence/risk-lab/phase-3-final-closure.json";
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

test("existe somente um Handoff canônico ativo", () => {
  const matches = walk(ROOT)
    .filter((file) => /handoff.*\.md$/i.test(path.basename(file)))
    .filter((file) => !file.startsWith("tests/fixtures/"))
    .sort();
  assert.deepEqual(matches, [HANDOFF]);
});

test("[REG-DEF-17] Handoff só conclui correções com evidência real de produção", () => {
  const body = text();
  assert.equal(body.split(/\r?\n/, 1)[0], EXACT_FIRST_LINE);
  assert.match(body, /\*\*Versão:\*\* 9\.0\.0/);
  assert.match(body, /\*\*Data:\*\* 27\/07\/2026/);
  assert.match(body, /607dafefefaba5c88f986236eb365440c6fb8c94/);
  assert.match(body, /0e029f78560d11d12720c447f2f9058c482e4277/);
  assert.match(body, /PRs corretivas mescladas:\*\* `#141`, `#142` e `#143`/);
  assert.match(body, /30236078462/);
  assert.match(body, /30236078473/);
  assert.match(body, /8641670026/);
  assert.match(body, /8a9709056d046a8f2f73d4e20e7cdcb77c861706b592c24a6333fdf566ee983b/);
  assert.match(body, /pKWEwtSiIbdatbauietl/);
  assert.match(body, /\*\*Estado oficial:\*\* Sprints Corretivas R0–R5 e Fase 3 formalmente concluídas/);
  assert.match(body, /E2E Chromium definitivo.*12\/12 aprovados/is);
  assert.match(body, /529 aprovados, zero falhos, zero ignorados, zero pendentes/);
  assert.match(body, /Fase 3 completa \| Sim \| Sim \| Sim \| Formalmente concluída/);
  assert.match(body, /Nenhuma\. As PRs foram mescladas sem bypass/);
  assert.doesNotMatch(body, /merge\/produção pendentes|aguardando smoke pós-deploy/i);
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

test("decisão nova substitui explicitamente a conclusão anterior", () => {
  const body = text();
  assert.match(body, /auditoria independente de 26\/07\/2026.*prevalece.*declaração anterior de conclusão da Fase 3/is);
  assert.match(body, /Handoff v6\.14\.0 declarava Fase 3 concluída sem os gates corretivos posteriores/);
  assert.match(body, /A Fase 3 volta a estar formalmente concluída com nova cadeia de evidências/);
  assert.match(body, /arquivo de continuação foi removido/);
});

test("evidência histórica permanece íntegra e a aprovação corretiva usa nova cadeia", () => {
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
  assert.match(text(), /aprovação corretiva posterior está nos runs `30236078462` e `30236078473`/);
  assert.match(text(), /evidência persistida de hash `8a970905…`/);
});

test("artefatos e gates corretivos permanentes existem", () => {
  for (const file of [
    "firestore.rules",
    "firestore.indexes.json",
    "firebase.json",
    "eslint.config.mjs",
    "playwright.config.ts",
    ".github/workflows/phase-2-closure.yml",
    ".github/workflows/production-premium-smoke.yml",
    "src/lib/observability/SafeLogger.ts",
    "src/lib/security/GithubActionsOidc.ts",
    "src/lib/risk-lab/PublicRiskLabEvidenceContract.ts",
    "src/lib/risk-lab/RiskLabCategoryPolicy.ts",
    "src/lib/reports/PremiumPeerSnapshot.ts",
    "scripts/run-http-smoke.mjs",
    "scripts/scan-secrets.mjs",
    "tests/firestore-rules.test.ts",
    "tests/e2e/critical-journeys.spec.ts",
  ]) {
    assert.equal(existsSync(file), true, `${file} deve existir`);
  }
});

test("[REG-DEF-10] pipeline bloqueia instalação inconsistente e vulnerabilidades de produção", () => {
  const workflow = text(".github/workflows/phase-2-closure.yml");
  for (const gate of [
    "npm ci",
    "npm run audit:production",
    "npm run security:secrets",
  ]) {
    assert.ok(workflow.includes(gate), gate);
  }
});

test("[REG-DEF-11] lint, TypeScript e build são gates bloqueantes", () => {
  const workflow = text(".github/workflows/phase-2-closure.yml");
  for (const gate of [
    "npm run lint",
    "npm run typecheck",
    "npm run build",
  ]) {
    assert.ok(workflow.includes(gate), gate);
  }
});

test("[REG-DEF-12] regressão, Emulator, cobertura, HTTP e E2E são obrigatórios", () => {
  const workflow = text(".github/workflows/phase-2-closure.yml");
  for (const gate of [
    "npm run test:all",
    "npm run test:rules",
    "npm run test:coverage:critical",
    "npm run test:mutation",
    "npm run test:http",
    "npm run test:e2e",
  ]) {
    assert.ok(workflow.includes(gate), gate);
  }
});

test("manifesto de regressão mantém DEF-01 a DEF-22 vinculados a testes executáveis", () => {
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

test("roadmap, segurança, generalização e decisões abertas permanecem explícitos", () => {
  const body = text();
  for (const required of [
    "Fase 4.1 — Radar/Acompanhar fundo fora da carteira",
    "Grátis acompanha até 1 fundo",
    "Premium até 10",
    "insufficient_data",
    "Risk Lab permanece read-only no Premium",
    "nenhum `route.ts` importa Firestore",
    "WhatsApp: custo, opt-in, template, frequência e proteção de dados",
    "Telegram permanece adiado",
    "cobrança recorrente, anual ou compra avulsa",
    "Nenhuma validação manual do usuário substitui essa obrigação",
  ]) {
    assert.ok(body.includes(required), required);
  }
});
