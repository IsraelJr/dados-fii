import { AutomaticDividendSeriesService } from "@/lib/risk-lab/AutomaticDividendSeriesService";
import { dividendStressWindowEngine } from "@/lib/risk-lab/DividendStressWindowEngine";
import { FnetDividendDocumentDiscovery } from "@/lib/risk-lab/FnetDividendDocumentDiscovery";
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

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function hasDividendDocument(documents: AutomaticDocumentEvidence[]) {
  return documents.some((document) => {
    const text = normalize(`${document.documentType} ${document.fileName}`);
    return text.includes("RENDIMENTO")
      || text.includes("AMORTIZACAO")
      || text.includes("PAGAMENTO DE PROVENTO");
  });
}

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

async function defaultResolveCnpj(ticker: string) {
  const { regulatoryDataService } = await import("@/lib/regulatoryDataService");
  const fund = await regulatoryDataService.getByTicker(ticker, { bypassCache: true });
  if (!fund) return null;
  const record = fund as unknown as Record<string, unknown>;
  const cnpj = digits(record.cnpj || record.CNPJ || record.cnpjFundo || record.cnpj_fundo);
  return cnpj.length === 14 ? cnpj : null;
}

function unavailable(message: string): AutomaticMonthlySeries {
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
  };
}

export interface ConcurrentAutomaticDividendSeriesDependencies {
  base?: Pick<AutomaticDividendSeriesService, "build">;
  discovery?: Pick<FnetDividendDocumentDiscovery, "discover">;
  resolveCnpj?: (ticker: string) => Promise<string | null>;
  yearConcurrency?: number;
  now?: () => Date;
}

/**
 * Mantém o mesmo parser e os mesmos gates do serviço FNET, mas processa
 * exercícios independentes em paralelo para caber na janela da função Vercel.
 * Quando o catálogo eventual não contém avisos estruturados, descobre os IDs
 * diretamente no gerenciador público do Fundos.NET, sem entrada manual.
 */
export class ConcurrentAutomaticDividendSeriesService {
  private readonly base: Pick<AutomaticDividendSeriesService, "build">;
  private readonly discovery: Pick<FnetDividendDocumentDiscovery, "discover">;
  private readonly resolveCnpj: (ticker: string) => Promise<string | null>;
  private readonly yearConcurrency: number;
  private readonly now: () => Date;

  constructor(dependencies: ConcurrentAutomaticDividendSeriesDependencies = {}) {
    this.base = dependencies.base || new AutomaticDividendSeriesService();
    this.discovery = dependencies.discovery || new FnetDividendDocumentDiscovery();
    this.resolveCnpj = dependencies.resolveCnpj || defaultResolveCnpj;
    this.yearConcurrency = Math.max(1, Math.min(4, dependencies.yearConcurrency || DEFAULT_YEAR_CONCURRENCY));
    this.now = dependencies.now || (() => new Date());
  }

  private async resolveDocuments(ticker: string, documents: AutomaticDocumentEvidence[]) {
    if (hasDividendDocument(documents)) return documents;
    const years = [...new Set(documents.map((document) => document.sourceYear))]
      .filter((year) => Number.isInteger(year) && year >= 2005)
      .sort((left, right) => left - right);
    if (!years.length) return documents;
    const cnpj = await this.resolveCnpj(ticker);
    if (!cnpj) throw new Error(`CNPJ não resolvido para descoberta de rendimentos de ${ticker}.`);
    const today = this.now().toISOString().slice(0, 10);
    const fromDate = `${years[0]}-01-01`;
    const nominalUntil = `${years.at(-1)}-12-31`;
    const untilDate = nominalUntil > today ? today : nominalUntil;
    const result = await this.discovery.discover(cnpj, fromDate, untilDate);
    if (!result.documents.length) {
      throw new Error(`Fundos.NET não retornou avisos estruturados de rendimentos para ${ticker} entre ${fromDate} e ${untilDate}.`);
    }
    return result.documents;
  }

  async build(ticker: string, documents: AutomaticDocumentEvidence[]): Promise<AutomaticMonthlySeries> {
    let resolvedDocuments: AutomaticDocumentEvidence[];
    try {
      resolvedDocuments = await this.resolveDocuments(ticker, documents);
    } catch (error) {
      return unavailable(error instanceof Error ? error.message : "Falha desconhecida na descoberta de rendimentos.");
    }

    const byYear = new Map<number, AutomaticDocumentEvidence[]>();
    for (const document of resolvedDocuments) {
      byYear.set(document.sourceYear, [...(byYear.get(document.sourceYear) || []), document]);
    }
    const years = [...byYear.keys()].sort((left, right) => left - right);
    if (!years.length) return this.base.build(ticker, resolvedDocuments);

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
