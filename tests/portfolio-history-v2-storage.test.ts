import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { portfolioHistoryAnnualDocumentId } from "../src/lib/portfolio/PortfolioHistoryRepository";

const repositorySource = readFileSync("src/server/repositories/FirestorePortfolioHistoryRepository.ts", "utf8");
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
  assert.match(repositorySource, /schemaVersion:\s*SCHEMA_VERSION/);
  assert.match(repositorySource, /\[`months\.\$\{month\}`\]/);
  assert.match(repositorySource, /SCHEMA_VERSION = 2/);
  assert.doesNotMatch(repositorySource, /doc\(portfolioHistoryDocumentId\(key\)\)/);
});

test("não lê estrutura legada de User e publica atualização para consumidores", () => {
  assert.doesNotMatch(repositorySource, /collection\(["']User["']\)/);
  assert.match(panelSource, /dados-fii-portfolio-history-updated/);
  assert.match(panelSource, /Salvar mês/);
  assert.match(panelSource, /salvos no histórico/);
});
