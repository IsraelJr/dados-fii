import assert from "node:assert/strict";
import test from "node:test";
import { ConcurrentAutomaticDividendSeriesService } from "../src/lib/risk-lab/ConcurrentAutomaticDividendSeriesService";
import type { AutomaticDocumentEvidence, AutomaticMonthlySeries } from "../src/types/riskLabAutomatic";
import type { VerifiedDividendNotice } from "../src/types/riskLabDividendStress";

function document(year: number, id: number): AutomaticDocumentEvidence {
  return {
    documentId: String(year * 100 + id),
    documentType: "Rendimentos e Amortizações",
    fileName: `rendimento-${year}-${id}.html`,
    competenceDate: `${year}-01-31`,
    receivedAt: `${year}-02-10T18:00:00-03:00`,
    link: "https://fnet.bmfbovespa.com.br/documento",
    sourceYear: year,
    auditResult: "OK",
    confidence: 99,
  };
}

function observation(ticker: string, year: number, month: number, amount = 1): VerifiedDividendNotice {
  const competenceMonth = `${year}-${String(month).padStart(2, "0")}`;
  return {
    ticker,
    competenceMonth,
    amountPerShare: amount,
    announcedAt: `${year}-${String(month).padStart(2, "0")}-15T18:00:00-03:00`,
    source: {
      documentId: `${year}${month}`,
      sourceUrl: "https://fnet.bmfbovespa.com.br/documento",
      sourceType: "primary_regulatory",
      reviewMethod: "automatic_regulatory_validation",
      reviewedBy: "test",
      reviewedAt: "2026-07-20T12:00:00-03:00",
      page: 1,
      excerpt: "Aviso oficial.",
      sourceHash: "a".repeat(64),
      protocolHash: "b".repeat(64),
      protocolVersion: 1,
    },
  };
}

function partial(ticker: string, year: number, months: number[]): AutomaticMonthlySeries {
  const observations = months.map((month) => observation(ticker, year, month));
  return {
    status: observations.length >= 9 ? "ready" : "incomplete",
    observations,
    sources: [{
      year,
      sourceUrl: "https://fnet.bmfbovespa.com.br",
      sourceHash: "c".repeat(64),
      fetched: true,
      documentsInspected: observations.length,
      matchingRows: observations.length,
      acceptedMonths: observations.length,
      error: null,
    }],
    missingMonths: [],
    conflicts: [],
    longestContiguousSequence: observations.length,
    method: "direct_declared_per_share",
    detectorResult: null,
    detectorExecuted: observations.length >= 9,
    classificationFinal: false,
    limitation: observations.length >= 9
      ? "material_credit_events_not_automatically_validated"
      : "insufficient_structured_series",
  };
}

test("processa exercícios com concorrência limitada e preserva ordem mensal", async () => {
  let active = 0;
  let maximumActive = 0;
  const base = {
    async build(ticker: string, documents: AutomaticDocumentEvidence[]) {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 20));
      const year = documents[0].sourceYear;
      active -= 1;
      return partial(ticker, year, [1, 2, 3, 4, 5, 6]);
    },
  };
  const service = new ConcurrentAutomaticDividendSeriesService({ base, yearConcurrency: 2 });
  const result = await service.build("MCCI11", [
    document(2023, 1),
    document(2024, 1),
    document(2025, 1),
  ]);

  assert.equal(maximumActive, 2);
  assert.equal(result.observations.length, 18);
  assert.equal(result.observations[0].competenceMonth, "2023-01");
  assert.equal(result.observations.at(-1)?.competenceMonth, "2025-06");
  assert.equal(result.sources.length, 3);
});

test("conflito entre exercícios permanece fail-closed", async () => {
  const base = {
    async build(ticker: string, documents: AutomaticDocumentEvidence[]) {
      const year = documents[0].sourceYear;
      const result = partial(ticker, year, [1]);
      result.observations[0] = observation(ticker, 2024, 1, year === 2024 ? 1 : 0.5);
      return result;
    },
  };
  const service = new ConcurrentAutomaticDividendSeriesService({ base, yearConcurrency: 2 });
  const result = await service.build("MCCI11", [document(2024, 1), document(2025, 1)]);

  assert.equal(result.status, "blocked");
  assert.ok(result.conflicts.some((item) => item.includes("Valores conflitantes")));
  assert.equal(result.detectorExecuted, false);
});

test("sem documentos delega ao serviço base sem criar resultado sintético", async () => {
  let delegated = false;
  const expected = partial("MCCI11", 2024, [1, 2]);
  const base = {
    async build() {
      delegated = true;
      return expected;
    },
  };
  const service = new ConcurrentAutomaticDividendSeriesService({ base });
  const result = await service.build("MCCI11", []);

  assert.equal(delegated, true);
  assert.equal(result, expected);
});
