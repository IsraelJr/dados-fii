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

test("existe somente um Handoff canônico ativo", () => {
  const matches = walk(ROOT)
    .filter((file) => /handoff.*\.md$/i.test(path.basename(file)))
    .filter((file) => !file.startsWith("tests/fixtures/"))
    .sort();
  assert.deepEqual(matches, [HANDOFF]);
});

test("Handoff v10.1 registra a nova fase sem apagar evidências históricas", () => {
  const body = text();
  assert.equal(body.split(/\r?\n/, 1)[0], EXACT_FIRST_LINE);
  assert.match(body, /\*\*Versão:\*\* 10\.1\.0/);
  assert.match(body, /\*\*Data:\*\* 27\/07\/2026/);
  assert.match(body, /Produto Validável/);
  assert.match(body, /PV-1 — Jornada principal da carteira e histórico manual/);
  assert.match(body, /agent\/product-validation-phase-1/);
  assert.match(body, /Issue atual:\*\* `#154`/);
  assert.match(body, /PR atual:\*\* `#155`/);
  assert.match(body, /0e029f78560d11d12720c447f2f9058c482e4277/);
  assert.match(body, /30236078462/);
  assert.match(body, /30236078473/);
  assert.match(body, /8641670026/);
  assert.match(body, /8a9709056d046a8f2f73d4e20e7cdcb77c861706b592c24a6333fdf566ee983b/);
  assert.match(body, /pKWEwtSiIbdatbauietl/);
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

test("nova prioridade substitui explicitamente SEO-S1 e AdSense", () => {
  const body = text();
  assert.match(body, /O projeto entrou na fase \*\*Produto Validável\*\*/);
  assert.match(body, /SEO-S1 era a sprint atual/);
  assert.match(body, /Google AdSense está congelado como prioridade de produto/);
  assert.match(body, /histórico manual do ano corrente será gratuito e sem propaganda/);
  assert.match(body, /Premium será visível para descoberta e beta antes do checkout/);
  assert.doesNotMatch(body, /\*\*Sprint atual:\*\* SEO-S1/);
});

test("PV-1 possui escopo e gates completos", () => {
  const body = text();
  for (const required of [
    "cadastro/login → carteira → persistência → histórico → diagnóstico",
    "proveniência: `manual`, `automatic_snapshot` ou `legacy`",
    "impedir duplicidade por usuário e competência",
    "não sobrescrever conflito silenciosamente",
    "isolamento entre usuários comprovado",
    "dezembro/janeiro",
    "mês corrente/encerrado",
    "smoke não destrutivo em produção",
    "telemetria mínima comprovada",
  ]) {
    assert.ok(body.includes(required), required);
  }
});

test("auditoria inicial da carteira permanece explícita", () => {
  const body = text();
  for (const required of [
    "src/app/carteira/page.tsx",
    "localStorage",
    "dados-fii-wallet-v1",
    "dados-fii-wallet-monthly-snapshots-v1",
    "parseCurrency",
    "carteira atual",
    "PR antiga `#65`",
  ]) {
    assert.ok(body.includes(required), required);
  }
});

test("documento de direção da nova fase existe", () => {
  assert.equal(existsSync(PRODUCT_DIRECTION), true);
  const body = text(PRODUCT_DIRECTION);
  assert.match(body, /Produto Validável/);
  assert.match(body, /PV-1/);
  assert.match(body, /Google AdSense/);
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

test("pipeline mantém gates bloqueantes", () => {
  const workflow = text(".github/workflows/phase-2-closure.yml");
  for (const gate of [
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
  ]) {
    assert.ok(workflow.includes(gate), gate);
  }
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

test("roadmap e decisões abertas permanecem explícitos", () => {
  const body = text();
  for (const required of [
    "PV-2 — Descoberta do Premium e beta controlado",
    "PV-3 — Telemetria, retenção e validação de disposição a pagar",
    "PV-5 — Radar/Acompanhar fundo fora da carteira",
    "Grátis acompanha até 1 fundo",
    "Premium até 10",
    "Risk Lab permanece read-only no Premium",
    "Nenhum `route.ts` importa Firestore",
    "WhatsApp: custo, opt-in, template, frequência e proteção de dados",
    "Telegram permanece adiado",
    "cobrança recorrente, anual ou compra avulsa",
    "Nenhuma validação manual do usuário substitui essa obrigação",
  ]) {
    assert.ok(body.includes(required), required);
  }
});
