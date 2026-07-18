import assert from "node:assert/strict";
import test from "node:test";
import { calculateDividendSeriesReadiness } from "../src/lib/risk-lab/DividendSeriesReadiness";
import type { VerifiedDividendNotice } from "../src/types/riskLabDividendStress";

function monthAfter(start: string, offset: number) {
  const [year, month] = start.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function notices(months: string[], ticker = "MCCI11"): VerifiedDividendNotice[] {
  return months.map((competenceMonth, index) => ({
    ticker,
    competenceMonth,
    amountPerShare: 1,
    announcedAt: `${monthAfter(competenceMonth, 1)}-05T18:00:00-03:00`,
    source: {
      documentId: `${ticker}-${index}`,
      sourceUrl: `https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?id=${index + 1}`,
      sourceType: "primary_regulatory",
      reviewMethod: "manual_document_review",
      reviewedBy: "risk-lab-test",
      reviewedAt: "2026-07-18T12:00:00-03:00",
      page: null,
      excerpt: "Aviso estruturado confirmado.",
    },
  }));
}

function consecutive(start: string, count: number) {
  return Array.from({ length: count }, (_, index) => monthAfter(start, index));
}

test("série vazia permanece não pronta e não executa detector", () => {
  const result = calculateDividendSeriesReadiness("MCCI11", []);

  assert.equal(result.approvedObservations, 0);
  assert.equal(result.longestContiguousCount, 0);
  assert.equal(result.readyForStressDetection, false);
  assert.equal(result.detectorExecuted, false);
});

test("oito meses consecutivos ainda não são suficientes", () => {
  const result = calculateDividendSeriesReadiness("MCCI11", notices(consecutive("2023-01", 8)));

  assert.equal(result.approvedObservations, 8);
  assert.equal(result.longestContiguousCount, 8);
  assert.equal(result.readyForStressDetection, false);
  assert.deepEqual(result.missingMonths, []);
});

test("nove meses consecutivos tornam a série tecnicamente suficiente", () => {
  const months = consecutive("2023-01", 9);
  const result = calculateDividendSeriesReadiness("MCCI11", notices(months));

  assert.equal(result.readyForStressDetection, true);
  assert.equal(result.longestContiguousCount, 9);
  assert.deepEqual(result.longestContiguousMonths, months);
  assert.equal(result.detectorExecuted, false);
});

test("nove observações com lacuna não fabricam sequência pronta", () => {
  const months = consecutive("2023-01", 10).filter((month) => month !== "2023-05");
  const result = calculateDividendSeriesReadiness("MCCI11", notices(months));

  assert.equal(result.approvedObservations, 9);
  assert.equal(result.readyForStressDetection, false);
  assert.deepEqual(result.missingMonths, ["2023-05"]);
  assert.equal(result.longestContiguousCount, 5);
});

test("identifica a maior sequência entre blocos separados", () => {
  const months = [
    ...consecutive("2022-01", 4),
    ...consecutive("2023-01", 7),
    ...consecutive("2024-01", 3),
  ];
  const result = calculateDividendSeriesReadiness("RBRY11", notices(months, "RBRY11"));

  assert.equal(result.longestContiguousCount, 7);
  assert.deepEqual(result.longestContiguousMonths, consecutive("2023-01", 7));
  assert.equal(result.readyForStressDetection, false);
});

test("competência duplicada é rejeitada", () => {
  const series = notices(["2023-01", "2023-01"]);
  assert.throws(() => calculateDividendSeriesReadiness("MCCI11", series), /Competência duplicada/);
});

test("mistura de tickers é rejeitada", () => {
  const series = notices(["2023-01", "2023-02"]);
  series[1].ticker = "RBRY11";
  assert.throws(() => calculateDividendSeriesReadiness("MCCI11", series), /Ticker divergente/);
});

test("resultado nunca afirma que o detector foi executado", () => {
  const result = calculateDividendSeriesReadiness("RBRY11", notices(consecutive("2023-01", 12), "RBRY11"));
  assert.equal(result.readyForStressDetection, true);
  assert.equal(result.detectorExecuted, false);
});
