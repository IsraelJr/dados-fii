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

test("[REG-DEF-17] Handoff registra o estado corretivo sem antecipar produção", () => {
  const body = text();
  assert.equal(body.split(/\r?\n/, 1)[0], EXACT_FIRST_LINE);
  assert.match(body, /\*\*Versão:\*\* 8\.1\.0/);
  assert.match(body, /\*\*Data:\*\* 27\/07\/2026/);
  assert.match(body, /607dafefefaba5c88f986236eb365440c6fb8c94/);
  assert.match(body, /agent\/corrective-sprints-r0-r5/);
  assert.match(body, /\*\*Estado oficial:\*\* implementação corretiva e gates locais concluídos, exceto browser E2E indisponível no sandbox/);
  assert.match(body, /529 aprovados, zero falhos, zero ignorados, zero pendentes/);
  assert.match(body, /Fase 3 completa \| Código histórico \+ correções \| Local \| Não \| Parcial/);
  assert.doesNotMatch(body, /correções formalmente concluídas|produção corretiva aprovada/i);
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
  assert.match(body, /Handoff v6\.14\.0 declarava Fase 3 formalmente concluída/);
  assert.match(body, /A Fase 3 volta a estado parcial/);
  assert.match(body, /arquivo de continuação foi removido/);
});

test("evidência final histórica permanece íntegra, mas não prova o branch corretivo", () => {
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
  assert.match(text(), /não prova as correções posteriores nem substitui o gate do SHA atual/);
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

test("manifesto de regressão mantém DEF-01 a DEF-20 vinculados a testes executáveis", () => {
  const testSources = walk(path.join(ROOT, "tests"))
    .filter((file) => /\.test\.(?:ts|mjs)$/.test(file))
    .map((file) => text(file))
    .join("\n");

  for (let number = 1; number <= 20; number += 1) {
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
    "nenhuma validação manual do usuário substitui essa obrigação",
  ]) {
    assert.ok(body.includes(required), required);
  }
});
