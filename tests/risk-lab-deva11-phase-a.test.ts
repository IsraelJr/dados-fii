import assert from "node:assert/strict";
import test from "node:test";
import { SingleFrozenDividendCaseFinalizer, type SingleFrozenDividendInput } from "../src/lib/risk-lab/SingleFrozenDividendCaseFinalizer";

function table(rows: Array<[string, string]>) {
  return `<html><body><table>${rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join("")}</table></body></html>`;
}
function notice(ticker: string, period: string, info = "08/01/2021") {
  return table([
    ["Nome do Fundo:", `FUNDO ${ticker}`], ["Data da Informação:", info], ["Código de negociação:", ticker],
    ["Data-base (último dia de negociação “com” direito ao provento)", info], ["Valor do provento (R$/unidade)", "1,00"],
    ["Data do pagamento", "15/01/2021"], ["Período de referência", period], ["Rendimento isento de IR*", "Sim"],
  ]);
}
function input(): SingleFrozenDividendInput {
  return {
    schemaVersion: 1, phase: "3.5-A", sourceArtifact: { artifactId: 1 },
    identity: { ticker: "AAAA11", cnpj: "00000000000001", role: "severe_deterioration", fromDate: "2021-01-01", untilDate: "2021-12-31" },
    checkpoint: {
      ticker: "AAAA11", cnpj: "00000000000001", fromDate: "2021-01-01", untilDate: "2021-12-31",
      discoveredDocumentIds: ["outside", "secondary", "valid"], completedDocumentIds: ["valid"],
      failuresByDocumentId: {
        outside: { documentId: "outside", message: "legacy", attempts: 1, retryable: false, lastAttemptAt: "2026-01-01T00:00:00Z" },
        secondary: { documentId: "secondary", message: "abort", attempts: 1, retryable: true, lastAttemptAt: "2026-01-01T00:00:00Z" },
      },
      observationsByDocumentId: {
        valid: { ticker: "AAAA11", competenceMonth: "2021-01", amountPerShare: 1, announcedAt: "2021-01-08T18:00:00-03:00", informationDate: "2021-01-08", baseDate: "2021-01-08", paymentDate: "2021-01-15", documentId: "valid", receivedAt: "2021-01-08T18:00:00-03:00", sourceUrl: "https://example/valid", protocolUrl: "https://example/protocol", page: 1, excerpt: "valid", sourceHash: "a".repeat(64), protocolHash: "b".repeat(64), protocolVersion: 1, sourceVersion: "test" },
      }, updatedAt: "2026-01-01T00:00:00Z",
    }, pendingDocumentIds: ["outside", "secondary"],
  };
}
function fetchImpl(inputValue: string | URL | Request) {
  const id = new URL(String(inputValue)).searchParams.get("id");
  const html = id === "outside" ? notice("AAAA11", "12-2020") : notice("AAAA13", "01-2021");
  return Promise.resolve(new Response(html, { status: 200 }));
}

test("finaliza um caso isolado com regras gerais e hash reproduzível", async () => {
  const first = await new SingleFrozenDividendCaseFinalizer({ fetchImpl: fetchImpl as typeof fetch, now: () => new Date("2026-07-22T13:00:00-03:00") }).finalize(input());
  const second = await new SingleFrozenDividendCaseFinalizer({ fetchImpl: fetchImpl as typeof fetch, now: () => new Date("2026-07-22T14:00:00-03:00") }).finalize(input());
  assert.equal(first.case.status, "complete");
  assert.equal(first.case.documentsProcessed, 3);
  assert.deepEqual(first.case.pendingDocumentIds, []);
  assert.deepEqual(first.case.conflicts, []);
  assert.equal(first.case.caseHash, second.case.caseHash);
  assert.equal(first.audit.auditHash, second.audit.auditHash);
  assert.deepEqual(first.audit.exclusions.map((item) => [item.documentId, item.classification]), [["outside", "outside_cohort_window"], ["secondary", "secondary_share_class"]]);
});

test("falha fechada quando documento primário pertence à janela", async () => {
  const value = input();
  value.pendingDocumentIds = ["outside"];
  value.checkpoint.discoveredDocumentIds = ["outside", "valid"];
  await assert.rejects(new SingleFrozenDividendCaseFinalizer({ fetchImpl: (() => Promise.resolve(new Response(notice("AAAA11", "02-2021"), { status: 200 }))) as typeof fetch }).finalize(value), /exige coleta completa/);
});
