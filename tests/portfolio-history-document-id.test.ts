import assert from "node:assert/strict";
import test from "node:test";
import { portfolioHistoryDocumentId } from "../src/lib/portfolio/PortfolioHistoryRepository";

test("gera id determinístico para owner legado identificado por e-mail", () => {
  const key = {
    ownerId: "israel.junior2111@gmail.com",
    portfolioId: "default",
    competence: "2026-04" as const,
  };

  const first = portfolioHistoryDocumentId(key);
  const second = portfolioHistoryDocumentId(key);

  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}__default__2026-04$/);
  assert.doesNotMatch(first, /@|\./);
});

test("owners diferentes não colidem", () => {
  const base = { portfolioId: "default", competence: "2026-04" as const };
  assert.notEqual(
    portfolioHistoryDocumentId({ ...base, ownerId: "a@example.com" }),
    portfolioHistoryDocumentId({ ...base, ownerId: "b@example.com" }),
  );
});

test("rejeita owner vazio e mantém validações de carteira e competência", () => {
  assert.throws(
    () => portfolioHistoryDocumentId({ ownerId: "", portfolioId: "default", competence: "2026-04" }),
    /INVALID_OWNER_ID/,
  );
  assert.throws(
    () => portfolioHistoryDocumentId({ ownerId: "user", portfolioId: "../x", competence: "2026-04" }),
    /INVALID_PORTFOLIO_ID/,
  );
});
