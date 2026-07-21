import assert from "node:assert/strict";
import test from "node:test";
import cohortRaw from "../src/lib/risk-lab/out-of-sample-cohort-v0.1.json";
import { ConcurrentAutomaticDividendSeriesService } from "../src/lib/risk-lab/ConcurrentAutomaticDividendSeriesService";
import {
  hashFrozenDividendCase,
  hashFrozenDividendDataset,
} from "../src/lib/risk-lab/FrozenDividendDatasetIntegrity";
import { FrozenDividendNoticeSeriesService } from "../src/lib/risk-lab/FrozenDividendNoticeSeriesService";
import { loadOutOfSampleCohort } from "../src/lib/risk-lab/ValidationCohortLoader";
import type { AutomaticMonthlySeries } from "../src/types/riskLabAutomatic";
import type {
  FrozenDividendNoticeCase,
  FrozenDividendNoticeDataset,
} from "../src/types/riskLabFrozenDividendDataset";

function month(value: number) {
  const year = Math.floor(value / 12);
  const number = value % 12 + 1;
  return `${year}-${String(number).padStart(2, "0")}`;
}

function buildDataset(): FrozenDividendNoticeDataset {
  const cohort = loadOutOfSampleCohort(cohortRaw);
  const cases = cohort.cases.map((item, caseIndex) => {
    const fromDate = item.analysisWindow.start;
    const untilDate = item.analysisWindow.end || "2026-07-21";
    const [year, startMonth] = fromDate.slice(0, 7).split("-").map(Number);
    const startIndex = year * 12 + startMonth - 1;
    const observations = Array.from({ length: 12 }, (_, index) => {
      const competenceMonth = month(startIndex + index);
      const documentId = String(900000 + caseIndex * 100 + index);
      const day = `${competenceMonth}-28`;
      return {
        ticker: item.ticker,
        competenceMonth,
        amountPerShare: 1,
        announcedAt: `${day}T18:00:00-03:00`,
        informationDate: day,
        baseDate: day,
        paymentDate: day,
        documentId,
        receivedAt: `${day}T18:00:00-03:00`,
        sourceUrl: `https://fnet.bmfbovespa.com.br/fnet/publico/exibirDocumento?cvm=true&id=${documentId}`,
        protocolUrl: `https://fnet.bmfbovespa.com.br/fnet/publico/visualizarProtocoloDocumentoCVM?idDocumento=${documentId}`,
        page: 1,
        excerpt: `Aviso estruturado ${documentId}.`,
        sourceHash: "a".repeat(64),
        protocolHash: "b".repeat(64),
        protocolVersion: 1,
        sourceVersion: "fnet-notice-protocol-v1",
      };
    });
    const withoutHash: Omit<FrozenDividendNoticeCase, "caseHash"> = {
      ticker: item.ticker,
      cnpj: String(caseIndex + 1).padStart(14, "0"),
      role: item.role,
      fromDate,
      untilDate,
      status: "complete",
      documentsDiscovered: observations.length,
      documentsProcessed: observations.length,
      pendingDocumentIds: [],
      failures: [],
      conflicts: [],
      missingMonths: [],
      longestContiguousSequence: observations.length,
      observations,
    };
    return { ...withoutHash, caseHash: hashFrozenDividendCase(withoutHash) };
  });
  const withoutHash: Omit<FrozenDividendNoticeDataset, "datasetHash"> = {
    schemaVersion: 1,
    datasetId: "risk-lab-fnet-dividend-notices-v0.1",
    datasetVersion: "0.1.0",
    collectorVersion: "1.0.0-test",
    status: "complete",
    generatedAt: "2026-07-21T20:00:00-03:00",
    releaseCommit: "c".repeat(40),
    cohortId: "risk-lab-credit-oos-v0.1",
    cohortVersion: "0.1.0",
    rulesetVersion: "0.1.0",
    cases,
  };
  return { ...withoutHash, datasetHash: hashFrozenDividendDataset(withoutHash) };
}

function rehash(dataset: FrozenDividendNoticeDataset) {
  dataset.cases = dataset.cases.map((item) => {
    const { caseHash: _caseHash, ...withoutHash } = item;
    return { ...withoutHash, caseHash: hashFrozenDividendCase(withoutHash) };
  });
  const { datasetHash: _datasetHash, ...withoutHash } = dataset;
  dataset.datasetHash = hashFrozenDividendDataset(withoutHash);
  return dataset;
}

test("carrega somente dataset congelado íntegro e executa o detector sobre avisos primários", async () => {
  const series = await new FrozenDividendNoticeSeriesService({ dataset: buildDataset() }).build("KNCR11");
  assert.equal(series.status, "ready");
  assert.equal(series.method, "frozen_primary_declared_per_share");
  assert.equal(series.observations.length, 12);
  assert.equal(series.detectorExecuted, true);
  assert.equal(series.observations.every((item) => item.source.sourceHash?.length === 64), true);
});

test("falha fechada quando o hash do dataset é alterado", async () => {
  const dataset = buildDataset();
  dataset.cases[0].observations[0].amountPerShare = 99;
  const series = await new FrozenDividendNoticeSeriesService({ dataset }).build("DEVA11");
  assert.equal(series.status, "blocked");
  assert.match(series.conflicts[0], /Hash do dataset congelado/);
});

test("bloqueia observação posterior à janela mesmo com hashes recalculados", async () => {
  const dataset = buildDataset();
  const control = dataset.cases.find((item) => item.ticker === "KNCR11");
  assert.ok(control);
  control.observations.at(-1)!.announcedAt = "2026-01-02T10:00:00-03:00";
  rehash(dataset);
  const series = await new FrozenDividendNoticeSeriesService({ dataset }).build("KNCR11");
  assert.equal(series.status, "blocked");
  assert.match(series.conflicts.join(" "), /Look-ahead/);
});

test("CVM mensal permanece somente como reconciliação auxiliar", async () => {
  const primary = await new FrozenDividendNoticeSeriesService({ dataset: buildDataset() }).build("KNCR11");
  const auxiliary: AutomaticMonthlySeries = {
    ...primary,
    method: "official_monthly_liability_per_share",
    observations: primary.observations.map((item, index) => ({
      ...item,
      amountPerShare: index === 1 ? 0.5 : item.amountPerShare,
    })),
    reconciliation: null,
  };
  const service = new ConcurrentAutomaticDividendSeriesService({
    primary: { build: async () => primary },
    monthly: { build: async () => auxiliary },
    resolveCnpj: async () => "12345678000199",
  });
  const result = await service.build("KNCR11", []);
  assert.equal(result.method, "frozen_primary_declared_per_share");
  assert.deepEqual(result.detectorResult, primary.detectorResult);
  assert.equal(result.reconciliation?.status, "available");
  assert.equal(result.reconciliation?.differences.length, 1);
  assert.equal(result.observations[1].amountPerShare, 1);
});
