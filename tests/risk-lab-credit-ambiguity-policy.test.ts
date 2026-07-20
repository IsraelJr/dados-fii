import assert from "node:assert/strict";
import test from "node:test";
import { AutomaticCreditEventScreeningService } from "../src/lib/risk-lab/AutomaticCreditEventScreeningService";
import type { AutomaticDocumentEvidence, AutomaticSourceSummary } from "../src/types/riskLabAutomatic";

const FROM = "2025-01-01T00:00:00-03:00";
const UNTIL = "2025-12-31T23:59:59-03:00";

function source(): AutomaticSourceSummary {
  return {
    year: 2025,
    sourceUrl: "https://dados.cvm.gov.br/fonte.csv",
    sourceHash: "a".repeat(64),
    fetched: true,
    matchingRows: 1,
    acceptedDocuments: 1,
    rejectedRows: 0,
    error: null,
  };
}

function document(documentType: string): AutomaticDocumentEvidence {
  return {
    documentId: "9001",
    documentType,
    fileName: `${documentType.toLowerCase().replace(/\s+/g, "-")}.pdf`,
    competenceDate: "2025-06-30",
    receivedAt: "2025-07-10T18:00:00-03:00",
    link: "https://dados.cvm.gov.br/documento.pdf",
    sourceYear: 2025,
    auditResult: "OK",
    confidence: 99,
  };
}

function pdfResponse() {
  return new Response("pdf", { status: 200, headers: { "content-type": "application/pdf" } });
}

test("relatório gerencial genérico em PDF não torna toda a janela inconclusiva", async () => {
  const service = new AutomaticCreditEventScreeningService({ fetchImpl: (async () => pdfResponse()) as typeof fetch });
  const result = await service.screen("KNCR11", [document("Relatório Gerencial")], [source()], FROM, UNTIL);

  assert.equal(result.status, "no_explicit_event_found");
  assert.equal(result.ambiguousDocuments.length, 0);
  assert.equal(result.sourceCoverageComplete, true);
});

test("fato relevante em PDF sem leitura determinística continua bloqueando", async () => {
  const service = new AutomaticCreditEventScreeningService({ fetchImpl: (async () => pdfResponse()) as typeof fetch });
  const result = await service.screen("KNCR11", [document("Fato Relevante")], [source()], FROM, UNTIL);

  assert.equal(result.status, "inconclusive");
  assert.equal(result.ambiguousDocuments.length, 1);
  assert.match(result.ambiguousDocuments[0].reason, /Formato application\/pdf/);
});
