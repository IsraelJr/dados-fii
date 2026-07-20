import { AutomaticDividendSeriesService } from "@/lib/risk-lab/AutomaticDividendSeriesService";
import { dividendStressWindowEngine } from "@/lib/risk-lab/DividendStressWindowEngine";
import type {
  AutomaticDocumentEvidence,
  AutomaticMonthlySeries,
} from "@/types/riskLabAutomatic";
import type { VerifiedDividendNotice } from "@/types/riskLabDividendStress";

const DEFAULT_YEAR_CONCURRENCY = 3;

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

function deduplicate(observations: VerifiedDividendNotice[]) {
  const grouped = new Map<string, VerifiedDividendNotice[]>();
  for (const observation of observations) {
    grouped.set(observation.competenceMonth, [
      ...(grouped.get(observation.competenceMonth) || []),
      observation,
    ]);
  }

  const accepted: VerifiedDividendNotice[] = [];
  const conflicts: string[] = [];
  for (const [month, values] of grouped) {
    const amounts = new Set(values.map((item) => item.amountPerShare.toFixed(8)));
    if (amounts.size > 1) {
      conflicts.push(`Valores conflitantes na competência ${month} entre exercícios regulatórios.`);
      continue;
    }
    values.sort((left, right) => Date.parse(right.announcedAt) - Date.parse(left.announcedAt));
    accepted.push(values[0]);
  }
  accepted.sort((left, right) => monthIndex(left.competenceMonth) - monthIndex(right.competenceMonth));
  return { observations: accepted, conflicts };
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const result = new Array<R>(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      result[index] = await mapper(values[index]);
    }
  });
  await Promise.all(workers);
  return result;
}

export interface ConcurrentAutomaticDividendSeriesDependencies {
  base?: Pick<AutomaticDividendSeriesService, "build">;
  yearConcurrency?: number;
}

/**
 * Mantém o mesmo parser e os mesmos gates do serviço FNET, mas processa
 * exercícios independentes em paralelo para caber na janela da função Vercel.
 */
export class ConcurrentAutomaticDividendSeriesService {
  private readonly base: Pick<AutomaticDividendSeriesService, "build">;
  private readonly yearConcurrency: number;

  constructor(dependencies: ConcurrentAutomaticDividendSeriesDependencies = {}) {
    this.base = dependencies.base || new AutomaticDividendSeriesService();
    this.yearConcurrency = Math.max(1, Math.min(4, dependencies.yearConcurrency || DEFAULT_YEAR_CONCURRENCY));
  }

  async build(ticker: string, documents: AutomaticDocumentEvidence[]): Promise<AutomaticMonthlySeries> {
    const byYear = new Map<number, AutomaticDocumentEvidence[]>();
    for (const document of documents) {
      byYear.set(document.sourceYear, [...(byYear.get(document.sourceYear) || []), document]);
    }
    const years = [...byYear.keys()].sort((left, right) => left - right);
    if (!years.length) return this.base.build(ticker, documents);

    const partials = await mapWithConcurrency(
      years,
      this.yearConcurrency,
      (year) => this.base.build(ticker, byYear.get(year) || []),
    );
    const deduplicated = deduplicate(partials.flatMap((partial) => partial.observations));
    const allConflicts = [
      ...partials.flatMap((partial) => partial.conflicts),
      ...deduplicated.conflicts,
    ];
    const globalCoverage = coverage(deduplicated.observations.map((item) => item.competenceMonth));
    const blocked = allConflicts.some((message) => !/falha desconhecida/i.test(message))
      && deduplicated.observations.length === 0;
    const ready = !blocked && allConflicts.filter((item) => item.startsWith("Valores conflitantes")).length === 0
      && globalCoverage.longest >= 9;

    return {
      status: blocked ? "blocked" : ready ? "ready" : "incomplete",
      observations: deduplicated.observations,
      sources: partials.flatMap((partial) => partial.sources)
        .filter((source, index, all) => all.findIndex((candidate) => candidate.year === source.year) === index)
        .sort((left, right) => right.year - left.year),
      missingMonths: globalCoverage.missingMonths,
      conflicts: allConflicts.slice(0, 120),
      longestContiguousSequence: globalCoverage.longest,
      method: deduplicated.observations.length ? "direct_declared_per_share" : "unavailable",
      detectorResult: ready ? dividendStressWindowEngine.detect(deduplicated.observations) : null,
      detectorExecuted: ready,
      classificationFinal: false,
      limitation: ready
        ? "material_credit_events_not_automatically_validated"
        : "insufficient_structured_series",
    };
  }
}

export const concurrentAutomaticDividendSeriesService = new ConcurrentAutomaticDividendSeriesService();
