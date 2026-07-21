import datasetRaw from "@/lib/risk-lab/frozen-dividend-notices-v0.1.json";
import cohortRaw from "@/lib/risk-lab/out-of-sample-cohort-v0.1.json";
import {
  hashFrozenDividendCase,
  sha256Text,
  verifyFrozenDividendDatasetHash,
} from "@/lib/risk-lab/FrozenDividendDatasetIntegrity";
import { dividendStressWindowEngine } from "@/lib/risk-lab/DividendStressWindowEngine";
import { loadOutOfSampleCohort } from "@/lib/risk-lab/ValidationCohortLoader";
import type {
  AutomaticDocumentEvidence,
  AutomaticMonthlySeries,
  AutomaticMonthlySourceSummary,
} from "@/types/riskLabAutomatic";
import type {
  FrozenDividendNoticeCase,
  FrozenDividendNoticeDataset,
} from "@/types/riskLabFrozenDividendDataset";
import type { VerifiedDividendNotice } from "@/types/riskLabDividendStress";

function monthIndex(value: string) {
  const [year, month] = value.split("-").map(Number);
  return year * 12 + month - 1;
}

function monthFromIndex(value: number) {
  const year = Math.floor(value / 12);
  const month = value % 12 + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function coverage(months: string[]) {
  if (!months.length) return { missingMonths: [] as string[], longest: 0 };
  const indexes = [...new Set(months.map(monthIndex))].sort((left, right) => left - right);
  const existing = new Set(indexes);
  const missingMonths: string[] = [];
  for (let index = indexes[0]; index <= indexes.at(-1)!; index += 1) {
    if (!existing.has(index)) missingMonths.push(monthFromIndex(index));
  }
  let longest = 1;
  let current = 1;
  for (let index = 1; index < indexes.length; index += 1) {
    current = indexes[index] === indexes[index - 1] + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return { missingMonths, longest };
}

function blocked(message: string): AutomaticMonthlySeries {
  return {
    status: "blocked",
    observations: [],
    sources: [],
    missingMonths: [],
    conflicts: [message],
    longestContiguousSequence: 0,
    method: "unavailable",
    detectorResult: null,
    detectorExecuted: false,
    classificationFinal: false,
    limitation: "insufficient_structured_series",
    reconciliation: null,
  };
}

function validCaseHash(item: FrozenDividendNoticeCase) {
  if (!/^[a-f0-9]{64}$/.test(item.caseHash)) return false;
  const { caseHash: _caseHash, ...withoutHash } = item;
  return hashFrozenDividendCase(withoutHash) === item.caseHash;
}

function validateDataset(value: unknown): FrozenDividendNoticeDataset {
  const dataset = value as FrozenDividendNoticeDataset;
  if (
    dataset?.schemaVersion !== 1
    || dataset.datasetId !== "risk-lab-fnet-dividend-notices-v0.1"
    || dataset.datasetVersion !== "0.1.0"
    || dataset.cohortId !== "risk-lab-credit-oos-v0.1"
    || dataset.cohortVersion !== "0.1.0"
    || dataset.rulesetVersion !== "0.1.0"
  ) throw new Error("Contrato do dataset congelado é inválido.");
  if (dataset.status !== "complete") throw new Error(`Dataset congelado ainda está ${dataset.status}.`);
  if (!verifyFrozenDividendDatasetHash(dataset)) throw new Error("Hash do dataset congelado é inválido.");

  const cohort = loadOutOfSampleCohort(cohortRaw);
  if (dataset.cases.length !== cohort.cases.length) throw new Error("Dataset congelado não cobre toda a coorte.");
  for (const item of cohort.cases) {
    const frozen = dataset.cases.find((candidate) => candidate.ticker === item.ticker);
    if (!frozen) throw new Error(`Caso ${item.ticker} ausente no dataset congelado.`);
    if (
      frozen.role !== item.role
      || frozen.fromDate !== item.analysisWindow.start
      || frozen.untilDate !== (item.analysisWindow.end || frozen.untilDate)
      || frozen.status !== "complete"
      || frozen.pendingDocumentIds.length > 0
      || frozen.failures.length > 0
      || frozen.conflicts.length > 0
      || !validCaseHash(frozen)
    ) throw new Error(`Caso congelado inválido para ${item.ticker}.`);
  }
  return dataset;
}

function sourceSummaries(observations: VerifiedDividendNotice[]): AutomaticMonthlySourceSummary[] {
  const byYear = new Map<number, VerifiedDividendNotice[]>();
  for (const observation of observations) {
    const year = Number(observation.announcedAt.slice(0, 4));
    byYear.set(year, [...(byYear.get(year) || []), observation]);
  }
  return [...byYear.entries()]
    .sort(([left], [right]) => left - right)
    .map(([year, items]) => ({
      year,
      sourceUrl: "https://fnet.bmfbovespa.com.br/fnet/publico/abrirGerenciadorDocumentosCVM",
      sourceHash: sha256Text(items
        .map((item) => `${item.source.sourceHash}:${item.source.protocolHash}:${item.source.protocolVersion}`)
        .sort()
        .join("|")),
      fetched: true,
      documentsInspected: items.length,
      matchingRows: items.length,
      acceptedMonths: new Set(items.map((item) => item.competenceMonth)).size,
      error: null,
    }));
}

export interface FrozenDividendNoticeSeriesDependencies {
  dataset?: unknown;
}

export class FrozenDividendNoticeSeriesService {
  private readonly rawDataset: unknown;

  constructor(dependencies: FrozenDividendNoticeSeriesDependencies = {}) {
    this.rawDataset = dependencies.dataset ?? datasetRaw;
  }

  async build(ticker: string, _documents: AutomaticDocumentEvidence[] = []): Promise<AutomaticMonthlySeries> {
    let dataset: FrozenDividendNoticeDataset;
    try {
      dataset = validateDataset(this.rawDataset);
    } catch (error) {
      return blocked(error instanceof Error ? error.message : "Dataset congelado indisponível.");
    }
    const item = dataset.cases.find((candidate) => candidate.ticker === ticker);
    if (!item) return blocked(`${ticker} não pertence ao dataset congelado.`);

    const end = Date.parse(`${item.untilDate}T23:59:59-03:00`);
    const seenMonths = new Set<string>();
    const conflicts: string[] = [];
    const observations: VerifiedDividendNotice[] = [];
    for (const observation of item.observations) {
      if (observation.ticker !== ticker) {
        conflicts.push(`Ticker divergente no documento ${observation.documentId}.`);
        continue;
      }
      if (Date.parse(observation.announcedAt) > end) {
        conflicts.push(`Look-ahead no documento ${observation.documentId}.`);
        continue;
      }
      if (seenMonths.has(observation.competenceMonth)) {
        conflicts.push(`Competência duplicada ${observation.competenceMonth}.`);
        continue;
      }
      if (
        !(observation.amountPerShare > 0)
        || !/^[a-f0-9]{64}$/.test(observation.sourceHash)
        || !/^[a-f0-9]{64}$/.test(observation.protocolHash)
        || observation.protocolVersion < 1
        || !observation.excerpt.trim()
      ) {
        conflicts.push(`Proveniência inválida no documento ${observation.documentId}.`);
        continue;
      }
      seenMonths.add(observation.competenceMonth);
      observations.push({
        ticker,
        competenceMonth: observation.competenceMonth,
        amountPerShare: observation.amountPerShare,
        announcedAt: observation.announcedAt,
        source: {
          documentId: observation.documentId,
          sourceUrl: observation.sourceUrl,
          sourceType: "primary_regulatory",
          reviewMethod: "automatic_regulatory_validation",
          reviewedBy: `risk-lab-frozen-dataset@${dataset.collectorVersion}`,
          reviewedAt: dataset.generatedAt || observation.announcedAt,
          page: observation.page,
          excerpt: observation.excerpt,
          sourceHash: observation.sourceHash,
          sourceVersion: observation.sourceVersion,
          protocolHash: observation.protocolHash,
          protocolVersion: observation.protocolVersion,
        },
      });
    }
    observations.sort((left, right) => monthIndex(left.competenceMonth) - monthIndex(right.competenceMonth));
    const series = coverage(observations.map((observation) => observation.competenceMonth));
    const ready = conflicts.length === 0 && series.longest >= 9;
    return {
      status: conflicts.length > 0 ? "blocked" : ready ? "ready" : "incomplete",
      observations,
      sources: sourceSummaries(observations),
      missingMonths: series.missingMonths,
      conflicts,
      longestContiguousSequence: series.longest,
      method: "frozen_primary_declared_per_share",
      detectorResult: ready ? dividendStressWindowEngine.detect(observations) : null,
      detectorExecuted: ready,
      classificationFinal: false,
      limitation: ready
        ? "material_credit_events_not_automatically_validated"
        : "insufficient_structured_series",
      reconciliation: null,
    };
  }
}

export const frozenDividendNoticeSeriesService = new FrozenDividendNoticeSeriesService();
