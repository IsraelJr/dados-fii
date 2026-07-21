import cohortRaw from "@/lib/risk-lab/out-of-sample-cohort-v0.1.json";
import { loadOutOfSampleCohort } from "@/lib/risk-lab/ValidationCohortLoader";

function digits(value: unknown) {
  return String(value || "").replace(/\D/g, "");
}

export interface RiskLabCohortIdentity {
  ticker: string;
  cnpj: string;
  role: "severe_deterioration" | "healthy_control" | "reversible_stress";
  fromDate: string;
  untilDate: string;
}

export class RiskLabCohortIdentityService {
  async list(now = new Date()): Promise<RiskLabCohortIdentity[]> {
    const cohort = loadOutOfSampleCohort(cohortRaw);
    const { regulatoryDataService } = await import("@/lib/regulatoryDataService");
    const identities: RiskLabCohortIdentity[] = [];

    for (const item of cohort.cases) {
      const fund = await regulatoryDataService.getByTicker(item.ticker, { bypassCache: true });
      if (!fund) throw new Error(`Ticker ${item.ticker} ausente no catálogo oficial.`);
      const record = fund as unknown as Record<string, unknown>;
      const cnpj = digits(record.cnpj || record.CNPJ || record.cnpjFundo || record.cnpj_fundo);
      if (cnpj.length !== 14) throw new Error(`CNPJ inválido para ${item.ticker}.`);
      identities.push({
        ticker: item.ticker,
        cnpj,
        role: item.role,
        fromDate: item.analysisWindow.start,
        untilDate: item.analysisWindow.end || now.toISOString().slice(0, 10),
      });
    }

    if (identities.length !== 6 || new Set(identities.map((item) => item.ticker)).size !== 6) {
      throw new Error("A coorte congelada não produziu seis identidades únicas.");
    }
    return identities;
  }
}

export const riskLabCohortIdentityService = new RiskLabCohortIdentityService();
