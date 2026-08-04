import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { portfolioHistoryAnnualDocumentId } from "../src/lib/portfolio/PortfolioHistoryRepository";

const repositorySource = readFileSync("src/server/repositories/FirestorePortfolioHistoryRepository.ts", "utf8");
const repositoryCoreSource = readFileSync("src/server/repositories/FirestorePortfolioHistoryRepositoryCore.ts", "utf8");
const panelSource = readFileSync("src/app/components/PortfolioHistoryPanel.tsx", "utf8");

test("usa um documento anual por owner e carteira", () => {
  const january = portfolioHistoryAnnualDocumentId({
    ownerId: "user@example.com",
    portfolioId: "default",
    competence: "2026-01",
  });
  const december = portfolioHistoryAnnualDocumentId({
    ownerId: "user@example.com",
    portfolioId: "default",
    competence: "2026-12",
  });
  const nextYear = portfolioHistoryAnnualDocumentId({
    ownerId: "user@example.com",
    portfolioId: "default",
    competence: "2027-01",
  });

  assert.equal(january, december);
  assert.notEqual(january, nextYear);
  assert.match(january, /^[a-f0-9]{64}__default__2026$/);
});

test("persiste meses como mapa dentro do documento anual", () => {
  assert.match(repositoryCoreSource, /schemaVersion:\s*SCHEMA_VERSION/);
  assert.match(repositoryCoreSource, /months:\s*\{[\s\S]*?\[month\]:/);
  assert.match(repositoryCoreSource, /SCHEMA_VERSION = 2/);
  assert.doesNotMatch(repositoryCoreSource, /\[`months\.\$\{month\}`\]:\s*\{/);
  assert.doesNotMatch(repositoryCoreSource, /doc\(portfolioHistoryDocumentId\(key\)\)/);
  assert.match(repositorySource, /FirestorePortfolioHistoryRepositoryCore/);
});

test("compatibilidade literal é restrita à migração e remoção lazy", () => {
  assert.match(repositoryCoreSource, /legacyMonthField/);
  assert.match(repositoryCoreSource, /"migrate" \| "deduplicate" \| "conflict"/);
  assert.match(repositoryCoreSource, /runTransaction/);
  assert.match(repositoryCoreSource, /PORTFOLIO_HISTORY_LEGACY_CONFLICT/);
  assert.match(repositoryCoreSource, /console\.warn\(diagnostic\.code, \{ year: diagnostic\.year, month: diagnostic\.month \}\)/);
  assert.doesNotMatch(repositoryCoreSource, /console\.warn\([^\n]*(?:ownerId|dividends)/);
});

test("não lê estrutura legada e publica atualização otimista para consumidores", () => {
  assert.doesNotMatch(repositorySource, /collection\(["']User["']\)/);
  assert.match(panelSource, /dados-fii-portfolio-history-updated/);
  assert.match(panelSource, /Salvar mês/);
  assert.match(panelSource, /writePending/);
  assert.match(panelSource, /scheduleFlush/);
  assert.match(panelSource, /atualizado •/);
});
