import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const ROOT = process.cwd();
const HANDOFF = "DADOS_FII_HANDOFF.md";
const HISTORICAL_EVIDENCE = "docs/production-evidence/risk-lab/phase-3-final-closure.json";
const PRODUCT_DIRECTION = "docs/product/product-validation-phase-1.md";
const ENV_INVENTORY = "docs/operations/runtime-environment-inventory.md";
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

test("Handoff identifica fase, sprint e governança vigentes", () => {
  const body = text();
  assert.equal(body.split(/\r?\n/, 1)[0], EXACT_FIRST_LINE);
  assert.match(body, /\*\*Versão:\*\* 10\.5\.0/);
  assert.match(body, /Produto Validável/);
  assert.match(body, /PV-3\.5 — SEO e Conteúdo de Mercado/);
  assert.match(body, /PV-1 está concluída funcionalmente/);
  assert.match(body, /PV-1, PV-2A, PV-2B, PV-2C e PV-3 ficam formalmente concluídas/);
  assert.match(body, /Google AdSense continua congelado/);
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

test("estado atual protege fonte única, IA explicativa, descoberta Premium e próxima sprint", () => {
  const body = text();
  assert.match(body, /PR `#166` consolidou gráfico e resumo sobre `consolidatedSnapshots`/);
  assert.match(body, /PR `#167` restaurou o layout original dos seis cards/);
  assert.match(body, /PR `#177` integrou a PV-2A/);
  assert.match(body, /PR `#178` integrou a PV-2B/);
  assert.match(body, /PR `#180` encerrou a PV-2C/);
  assert.match(body, /PR `#181` encerra a PV-3/);
  assert.match(body, /IA nunca é fonte de verdade para cálculo financeiro/);
  assert.match(body, /A explicação por IA ocorre apenas após ação explícita do usuário/);
  assert.match(body, /Solicitar beta não concede entitlement/);
  assert.match(body, /hub público sobre o mercado de fundos imobiliários/);
  assert.match(body, /Nenhuma transformação de código-fonte em `predev`, `prebuild` ou `buildCommand`/);
});

test("regras críticas de arquitetura, privacidade editorial e conclusão permanecem explícitas", () => {
  const body = text();
  assert.match(body, /Nenhum `route\.ts` importa Firestore diretamente/);
  assert.match(body, /Logs e telemetria não contêm valores financeiros/);
  assert.match(body, /Eventos de produto usam identidade pseudonimizada/);
  assert.match(body, /Conteúdo editorial conjuntural exige data-base, fonte e limitação explícitas/);
  assert.match(body, /Página sem qualidade mínima não é indexada ou publicada/);
  assert.match(body, /CI é gate de merge e deploy/);
  assert.match(body, /Nenhuma validação manual substitui esses gates/);
  assert.match(body, /número novo ou recomendação falha fechado e usa fallback determinístico/);
});

test("documentos auxiliares canônicos existem e estão atualizados", () => {
  for (const file of [PRODUCT_DIRECTION, ENV_INVENTORY]) assert.equal(existsSync(file), true, file);
  assert.match(text(PRODUCT_DIRECTION), /PV-2A — Inteligência da Carteira: núcleo determinístico/);
  assert.match(text(PRODUCT_DIRECTION), /Codex: implementação, testes, commits, PR e relatório técnico/);
  assert.match(text(ENV_INVENTORY), /Inventário de variáveis de ambiente/);
  assert.match(text(ENV_INVENTORY), /`ENABLE_PREMIUM_DISCOVERY`/);
  assert.match(text(ENV_INVENTORY), /`PREMIUM_BETA_UIDS`/);
  assert.match(text(ENV_INVENTORY), /`PREMIUM_BETA_EMAILS`/);
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
  ]) assert.ok(workflow.includes(gate), gate);
});
