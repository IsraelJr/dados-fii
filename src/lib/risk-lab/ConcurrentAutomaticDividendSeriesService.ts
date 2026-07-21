import {
  CvmMonthlyCohortDividendSeriesAdapter,
  type CvmMonthlyCohortDividendSeriesAdapterDependencies,
} from "@/lib/risk-lab/CvmMonthlyCohortDividendSeriesAdapter";
import { FrozenDividendNoticeSeriesService } from "@/lib/risk-lab/FrozenDividendNoticeSeriesService";
import type {
  AutomaticDocumentEvidence,
  AutomaticMonthlySeries,
} from "@/types/riskLabAutomatic";
import type { FrozenDividendReconciliation } from "@/types/riskLabFrozenDividendDataset";

export interface ConcurrentAutomaticDividendSeriesDependencies
  extends CvmMonthlyCohortDividendSeriesAdapterDependencies {
  /** Mantido apenas para compatibilidade com a construção segmentada anterior. */
  yearConcurrency?: number;
  primary?: Pick<FrozenDividendNoticeSeriesService, "build">;
}

function reconcile(
  primary: AutomaticMonthlySeries,
  auxiliary: AutomaticMonthlySeries,
): FrozenDividendReconciliation {
  const auxiliaryByMonth = new Map(
    auxiliary.observations.map((item) => [item.competenceMonth, item.amountPerShare]),
  );
  const differences: FrozenDividendReconciliation["differences"] = [];
  let exactMatches = 0;
  let comparedMonths = 0;
  for (const item of primary.observations) {
    const auxiliaryAmount = auxiliaryByMonth.get(item.competenceMonth);
    if (typeof auxiliaryAmount !== "number") continue;
    comparedMonths += 1;
    if (Math.abs(item.amountPerShare - auxiliaryAmount) <= 1e-8) exactMatches += 1;
    else differences.push({
      competenceMonth: item.competenceMonth,
      primaryAmountPerShare: item.amountPerShare,
      auxiliaryAmountPerShare: auxiliaryAmount,
    });
  }
  return {
    source: "cvm_monthly_bulk",
    status: "available",
    comparedMonths,
    exactMatches,
    differences,
    note: "O Informe Mensal CVM é usado somente como reconciliação contábil auxiliar e não alimenta o detector.",
  };
}

/**
 * O detector usa exclusivamente os avisos primários congelados. O lote mensal
 * da CVM permanece como reconciliação auxiliar, sem alterar classificação,
 * cobertura ou valores da série principal.
 */
export class ConcurrentAutomaticDividendSeriesService {
  private readonly primary: Pick<FrozenDividendNoticeSeriesService, "build">;
  private readonly auxiliary: CvmMonthlyCohortDividendSeriesAdapter;

  constructor(dependencies: ConcurrentAutomaticDividendSeriesDependencies = {}) {
    this.primary = dependencies.primary || new FrozenDividendNoticeSeriesService();
    this.auxiliary = new CvmMonthlyCohortDividendSeriesAdapter({
      monthly: dependencies.monthly,
      resolveCnpj: dependencies.resolveCnpj,
      now: dependencies.now,
    });
  }

  async build(ticker: string, documents: AutomaticDocumentEvidence[]): Promise<AutomaticMonthlySeries> {
    const primary = await this.primary.build(ticker, documents);
    if (primary.status === "blocked") return primary;
    try {
      const auxiliary = await this.auxiliary.build(ticker, documents);
      return { ...primary, reconciliation: reconcile(primary, auxiliary) };
    } catch (error) {
      return {
        ...primary,
        reconciliation: {
          source: "cvm_monthly_bulk",
          status: "unavailable",
          comparedMonths: 0,
          exactMatches: 0,
          differences: [],
          note: error instanceof Error
            ? `Reconciliação auxiliar indisponível: ${error.message}`
            : "Reconciliação auxiliar indisponível.",
        },
      };
    }
  }
}

export const concurrentAutomaticDividendSeriesService = new ConcurrentAutomaticDividendSeriesService();
