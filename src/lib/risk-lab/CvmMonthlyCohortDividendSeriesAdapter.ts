import cohortRaw from "@/lib/risk-lab/out-of-sample-cohort-v0.1.json";
import { CvmMonthlyDividendSeriesService } from "@/lib/risk-lab/CvmMonthlyDividendSeriesService";
import { loadOutOfSampleCohort } from "@/lib/risk-lab/ValidationCohortLoader";
import type { AutomaticDocumentEvidence, AutomaticMonthlySeries } from "@/types/riskLabAutomatic";

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

async function resolveCnpj(ticker: string) {
  const { regulatoryDataService } = await import("@/lib/regulatoryDataService");
  const fund = await regulatoryDataService.getByTicker(ticker, { bypassCache: true });
  if (!fund) throw new Error(`Ticker ${ticker} ausente no catálogo oficial.`);
  const record = fund as unknown as Record<string, unknown>;
  const cnpj = digits(record.cnpj || record.CNPJ || record.cnpjFundo || record.cnpj_fundo);
  if (cnpj.length !== 14) throw new Error(`CNPJ inválido para ${ticker}.`);
  return cnpj;
}

export interface CvmMonthlyCohortDividendSeriesAdapterDependencies {
  monthly?: Pick<CvmMonthlyDividendSeriesService, "build">;
  resolveCnpj?: (ticker: string) => Promise<string>;
  now?: () => Date;
}

/**
 * Mantém o contrato legado build(ticker, documents) consumido pelo executor
 * congelado, mas substitui o scraping documento a documento pelo ZIP anual
 * oficial da CVM. A janela vem exclusivamente da coorte pré-registrada.
 */
export class CvmMonthlyCohortDividendSeriesAdapter {
  private readonly monthly: Pick<CvmMonthlyDividendSeriesService, "build">;
  private readonly cnpjFor: (ticker: string) => Promise<string>;
  private readonly now: () => Date;
  private readonly cohort = loadOutOfSampleCohort(cohortRaw);

  constructor(dependencies: CvmMonthlyCohortDividendSeriesAdapterDependencies = {}) {
    this.monthly = dependencies.monthly || new CvmMonthlyDividendSeriesService();
    this.cnpjFor = dependencies.resolveCnpj || resolveCnpj;
    this.now = dependencies.now || (() => new Date());
  }

  async build(ticker: string, _documents: AutomaticDocumentEvidence[]): Promise<AutomaticMonthlySeries> {
    const item = this.cohort.cases.find((candidate) => candidate.ticker === ticker);
    if (!item) throw new Error(`${ticker} não pertence à coorte externa congelada.`);
    const untilDate = item.analysisWindow.end || this.now().toISOString().slice(0, 10);
    const startYear = Number(item.analysisWindow.start.slice(0, 4));
    const endYear = Number(untilDate.slice(0, 4));
    const years: number[] = [];
    for (let year = startYear; year <= endYear; year += 1) years.push(year);
    return this.monthly.build(
      ticker,
      await this.cnpjFor(ticker),
      years,
      item.analysisWindow.start,
      untilDate,
    );
  }
}

export const cvmMonthlyCohortDividendSeriesAdapter = new CvmMonthlyCohortDividendSeriesAdapter();
