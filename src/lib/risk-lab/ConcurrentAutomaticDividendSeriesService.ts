import {
  CvmMonthlyCohortDividendSeriesAdapter,
  type CvmMonthlyCohortDividendSeriesAdapterDependencies,
} from "@/lib/risk-lab/CvmMonthlyCohortDividendSeriesAdapter";
import type {
  AutomaticDocumentEvidence,
  AutomaticMonthlySeries,
} from "@/types/riskLabAutomatic";

export interface ConcurrentAutomaticDividendSeriesDependencies
  extends CvmMonthlyCohortDividendSeriesAdapterDependencies {
  /** Mantido apenas para compatibilidade com a construção segmentada anterior. */
  yearConcurrency?: number;
}

/**
 * Compatibilidade de nome para o executor segmentado. A coleta concorrente de
 * páginas individuais do Fundos.NET foi removida do caminho crítico. O serviço
 * agora usa um ZIP anual oficial da CVM por exercício e cacheia cada arquivo.
 */
export class ConcurrentAutomaticDividendSeriesService {
  private readonly adapter: CvmMonthlyCohortDividendSeriesAdapter;

  constructor(dependencies: ConcurrentAutomaticDividendSeriesDependencies = {}) {
    this.adapter = new CvmMonthlyCohortDividendSeriesAdapter({
      monthly: dependencies.monthly,
      resolveCnpj: dependencies.resolveCnpj,
      now: dependencies.now,
    });
  }

  build(ticker: string, documents: AutomaticDocumentEvidence[]): Promise<AutomaticMonthlySeries> {
    return this.adapter.build(ticker, documents);
  }
}

export const concurrentAutomaticDividendSeriesService = new ConcurrentAutomaticDividendSeriesService();
