import { dividendStressWindowEngine } from "@/lib/risk-lab/DividendStressWindowEngine";
import {
  deriveCvmMonthlyYear,
  parseCvmMonthlyArchive,
  type CvmMonthlyArchive,
} from "@/lib/risk-lab/CvmMonthlyBulkParser";
import type {
  AutomaticMonthlySeries,
  AutomaticMonthlySourceSummary,
} from "@/types/riskLabAutomatic";
import type { VerifiedDividendNotice } from "@/types/riskLabDividendStress";

const BASE_URL = "https://dados.cvm.gov.br/dados/FII/DOC/INF_MENSAL/DADOS";
const MAX_ZIP_BYTES = 15 * 1024 * 1024;
const TIMEOUT_MS = 60_000;
const FETCH_ATTEMPTS = 3;

function retryable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /AbortError|aborted|HTTP (408|425|429|5\d\d)|network|fetch failed|socket|ECONNRESET|ETIMEDOUT/i.test(message)
    || (error instanceof Error && error.name === "AbortError");
}

async function fetchYear(fetchImpl: typeof fetch, year: number): Promise<CvmMonthlyArchive> {
  const sourceUrl = `${BASE_URL}/inf_mensal_fii_${year}.zip`;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetchImpl(sourceUrl, {
        method: "GET",
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          Accept: "application/zip,application/octet-stream,*/*;q=0.1",
          "User-Agent": "DadosFII-RiskLab/0.5 (+cvm-monthly-bulk-primary-evidence)",
        },
      });
      if (!response.ok) throw new Error(`CVM respondeu HTTP ${response.status}.`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 100 || bytes.byteLength > MAX_ZIP_BYTES) {
        throw new Error(`ZIP CVM ${year} fora do limite seguro (${bytes.byteLength} bytes).`);
      }
      return parseCvmMonthlyArchive(year, sourceUrl, bytes);
    } catch (error) {
      lastError = error;
      if (attempt === FETCH_ATTEMPTS || !retryable(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Falha ao obter o informe mensal ${year}.`);
}

function monthIndex(value: string) {
  const [year, month] = value.split("-").map(Number);
  return year * 12 + month - 1;
}

function monthFromIndex(value: number) {
  return `${Math.floor(value / 12)}-${String(value % 12 + 1).padStart(2, "0")}`;
}

function coverage(months: string[]) {
  if (!months.length) return { missingMonths: [] as string[], longest: 0 };
  const indexes = [...new Set(months.map(monthIndex))].sort((a, b) => a - b);
  const existing = new Set(indexes);
  const missingMonths: string[] = [];
  for (let index = indexes[0]; index <= indexes[indexes.length - 1]; index += 1) {
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

export interface CvmMonthlyDividendSeriesDependencies {
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export class CvmMonthlyDividendSeriesService {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly cache = new Map<number, Promise<CvmMonthlyArchive>>();

  constructor(dependencies: CvmMonthlyDividendSeriesDependencies = {}) {
    this.fetchImpl = dependencies.fetchImpl || fetch;
    this.now = dependencies.now || (() => new Date());
  }

  private archive(year: number) {
    const current = this.cache.get(year);
    if (current) return current;
    const pending = fetchYear(this.fetchImpl, year);
    this.cache.set(year, pending);
    return pending;
  }

  async build(
    ticker: string,
    cnpj: string,
    years: number[],
    fromDate: string,
    untilDate: string,
  ): Promise<AutomaticMonthlySeries> {
    const selectedYears = [...new Set(years.map(Math.trunc))]
      .filter((year) => year >= 2016 && year <= this.now().getFullYear())
      .sort((a, b) => a - b);
    if (!selectedYears.length) throw new Error("Nenhum ano válido foi informado para o informe mensal CVM.");

    const observations: VerifiedDividendNotice[] = [];
    const conflicts: string[] = [];
    const sources: AutomaticMonthlySourceSummary[] = [];
    const reviewedAt = this.now().toISOString();

    for (const year of selectedYears) {
      try {
        const result = deriveCvmMonthlyYear(
          ticker,
          cnpj,
          await this.archive(year),
          fromDate,
          untilDate,
          reviewedAt,
        );
        observations.push(...result.observations);
        conflicts.push(...result.conflicts.map((message) => `${year}: ${message}`));
        sources.push(result.source);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha desconhecida no informe mensal CVM.";
        conflicts.push(`${year}: ${message}`);
        sources.push({
          year,
          sourceUrl: `${BASE_URL}/inf_mensal_fii_${year}.zip`,
          sourceHash: null,
          fetched: false,
          documentsInspected: 0,
          matchingRows: 0,
          acceptedMonths: 0,
          error: message,
        });
      }
    }

    observations.sort((a, b) => a.competenceMonth.localeCompare(b.competenceMonth));
    const unique = observations.filter((item, index, all) =>
      all.findIndex((candidate) => candidate.competenceMonth === item.competenceMonth) === index,
    );
    const duplicates = observations
      .map((item) => item.competenceMonth)
      .filter((month, index, all) => all.indexOf(month) !== index);
    if (duplicates.length) conflicts.push(`Competências duplicadas: ${[...new Set(duplicates)].join(", ")}.`);

    const { missingMonths, longest } = coverage(unique.map((item) => item.competenceMonth));
    const blocked = conflicts.length > 0 || sources.some((source) => !source.fetched) || unique.length === 0;
    const ready = !blocked && missingMonths.length === 0 && longest >= 9;
    return {
      status: blocked ? "blocked" : ready ? "ready" : "incomplete",
      observations: unique,
      sources,
      missingMonths,
      conflicts: conflicts.slice(0, 120),
      longestContiguousSequence: longest,
      method: unique.length ? "official_monthly_liability_per_share" : "unavailable",
      detectorResult: ready ? dividendStressWindowEngine.detect(unique) : null,
      detectorExecuted: ready,
      classificationFinal: false,
      limitation: ready
        ? "material_credit_events_not_automatically_validated"
        : "insufficient_structured_series",
    };
  }
}

export const cvmMonthlyDividendSeriesService = new CvmMonthlyDividendSeriesService();
