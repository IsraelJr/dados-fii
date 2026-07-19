import assert from "node:assert/strict";
import test from "node:test";
import { parseCvmEventualCsv } from "../src/lib/risk-lab/CvmEventualCsvParser";
import { CvmEventualDocumentDiscovery } from "../src/lib/risk-lab/CvmEventualDocumentDiscovery";
import { RiskLabTickerOrchestrator } from "../src/lib/risk-lab/RiskLabTickerOrchestrator";
import type { PublicFundData } from "../src/types/regulatory";

const HEADER = "TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;DENOM_SOCIAL;ID_SUBCLASSE;DT_COMPTC;DT_RECEB;TP_DOC;NM_ARQ;ID_DOC;LINK_ARQ;RESULTADO_AUDITORIA";
const CNPJ = "12.345.678/0001-90";

function csv(link = "https://dados.cvm.gov.br/documento.pdf") {
  return `${HEADER}\nFII;${CNPJ};FUNDO TESTE;;2025-01-31;2025-02-10 18:30:00;Fato Relevante;fato.pdf;12345;${link};OK`;
}

function response(body: string, status = 200) {
  return new Response(new TextEncoder().encode(body), { status, headers: { "content-type": "text/csv" } });
}

test("parser accepts an official CVM row for the expected CNPJ", () => {
  const result = parseCvmEventualCsv(csv(), CNPJ, 2025);
  assert.equal(result.matchingRows, 1);
  assert.equal(result.documents.length, 1);
  assert.equal(result.documents[0].documentId, "12345");
  assert.equal(result.documents[0].confidence, 99);
});

test("parser rejects a non-official link without asking for human approval", () => {
  const result = parseCvmEventualCsv(csv("https://example.com/fato.pdf"), CNPJ, 2025);
  assert.equal(result.matchingRows, 1);
  assert.equal(result.documents.length, 0);
  assert.equal(result.issues.some((issue) => issue.severity === "error"), true);
});

test("parser ignores another CNPJ", () => {
  const result = parseCvmEventualCsv(csv(), "00.000.000/0001-00", 2025);
  assert.equal(result.matchingRows, 0);
  assert.equal(result.documents.length, 0);
});

test("ticker orchestrator resolves identity and interrupts automatically when the series is incomplete", async () => {
  const discovery = new CvmEventualDocumentDiscovery(async () => response(csv()));
  const orchestrator = new RiskLabTickerOrchestrator({
    resolveFund: async () => ({ cnpj: CNPJ, name: "MCCI Fundo Teste" } as unknown as PublicFundData),
    discovery,
    now: () => new Date("2026-07-18T20:00:00-03:00"),
  });
  const scan = await orchestrator.scan("mcci11", "admin@example.com");
  assert.equal(scan.status, "inconclusive");
  assert.equal(scan.identity.ticker, "MCCI11");
  assert.equal(scan.requiresHumanDocumentValidation, false);
  assert.equal(scan.analysisReadiness, "structured_series_incomplete");
  assert.equal(scan.monthlySeries?.detectorExecuted, false);
  assert.equal(scan.premiumIntegrated, false);
  assert.equal(scan.notificationsSent, false);
});

test("ticker orchestrator blocks automatically when every official source fails", async () => {
  const discovery = new CvmEventualDocumentDiscovery(async () => response("", 503));
  const orchestrator = new RiskLabTickerOrchestrator({
    resolveFund: async () => ({ cnpj: CNPJ, name: "MCCI Fundo Teste" } as unknown as PublicFundData),
    discovery,
    now: () => new Date("2026-07-18T20:00:00-03:00"),
  });
  const scan = await orchestrator.scan("MCCI11", "admin@example.com");
  assert.equal(scan.status, "blocked");
  assert.equal(scan.analysisReadiness, "blocked");
  assert.equal(scan.requiresHumanDocumentValidation, false);
});

test("ticker orchestrator rejects invalid or unknown tickers", async () => {
  const orchestrator = new RiskLabTickerOrchestrator({ resolveFund: async () => null });
  await assert.rejects(() => orchestrator.scan("123", "admin@example.com"), /Ticker inválido/);
  await assert.rejects(() => orchestrator.scan("ABCD11", "admin@example.com"), /não encontrado/);
});
