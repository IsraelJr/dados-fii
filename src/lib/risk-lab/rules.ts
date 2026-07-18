import type { MetricObservation, RiskRule, RiskSnapshot } from "../../types/riskLab";

const VERSION = "0.1.0";

function observation(snapshot: RiskSnapshot, metric: string): MetricObservation | null {
  return snapshot.observations[metric] ?? null;
}

function numberMetric(snapshot: RiskSnapshot, metric: string): number | null {
  const value = observation(snapshot, metric)?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanMetric(snapshot: RiskSnapshot, metric: string): boolean | null {
  const value = observation(snapshot, metric)?.value;
  return typeof value === "boolean" ? value : null;
}

function confidence(snapshot: RiskSnapshot, metrics: string[]) {
  const values = metrics
    .map((metric) => observation(snapshot, metric)?.confidence)
    .filter((value): value is number => typeof value === "number");
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function coverage(snapshot: RiskSnapshot, cashMetric = "cashResultPerShare", dividendMetric = "dividendPerShare") {
  const cash = numberMetric(snapshot, cashMetric);
  const dividend = numberMetric(snapshot, dividendMetric);
  if (cash === null || dividend === null || dividend <= 0) return null;
  return cash / dividend;
}

export const PILOT_RISK_RULES: RiskRule[] = [
  {
    id: "STRUCT-001",
    version: VERSION,
    title: "Risco estrutural extremo",
    description: "Sinaliza teses cuja combinação de complexidade, subordinação, concentração e verificabilidade exige limite prudencial de posição.",
    families: ["common"],
    dimension: "structural",
    alert: "yellow",
    weight: 0,
    evaluate: ({ snapshot }) => snapshot.structuralRiskScore >= 85 ? {
      message: `Risco estrutural ${snapshot.structuralRiskScore}/100 exige tratamento como posição satélite.`,
      confidence: 90,
      evidenceMetrics: ["structuralRiskScore"],
    } : null,
  },
  {
    id: "TR-001",
    version: VERSION,
    title: "Divulgação material removida",
    description: "Detecta desaparecimento de tabela ou indicador material sem reconciliação.",
    families: ["common"],
    dimension: "transparency",
    alert: "yellow",
    weight: 20,
    evaluate: ({ snapshot }) => booleanMetric(snapshot, "materialDisclosureRemoved") === true ? {
      message: "Uma divulgação material desapareceu sem reconciliação suficiente.",
      confidence: confidence(snapshot, ["materialDisclosureRemoved"]),
      evidenceMetrics: ["materialDisclosureRemoved"],
    } : null,
  },
  {
    id: "TR-002",
    version: VERSION,
    title: "Mudança metodológica sem reconciliação",
    description: "Detecta mudança de definição ou metodologia que prejudica a comparabilidade histórica.",
    families: ["common"],
    dimension: "transparency",
    alert: "yellow",
    weight: 20,
    evaluate: ({ snapshot }) => booleanMetric(snapshot, "methodologyChangedWithoutReconciliation") === true ? {
      message: "A metodologia de uma métrica material mudou sem ponte de reconciliação.",
      confidence: confidence(snapshot, ["methodologyChangedWithoutReconciliation"]),
      evidenceMetrics: ["methodologyChangedWithoutReconciliation"],
    } : null,
  },
  {
    id: "HY-001",
    version: VERSION,
    title: "Carteira de crédito sob estresse",
    description: "Percentual em dia abaixo de 60% ou carência mais inadimplência acima de 40%.",
    families: ["credit_high_yield", "fiagro_credit", "fiinfra_credit"],
    dimension: "deterioration",
    alert: "yellow",
    weight: 30,
    evaluate: ({ snapshot }) => {
      const current = numberMetric(snapshot, "currentAssetsPercent");
      const grace = numberMetric(snapshot, "graceAssetsPercent");
      const defaulted = numberMetric(snapshot, "defaultedAssetsPercent");
      const stressed = grace !== null && defaulted !== null ? grace + defaulted : null;
      if (!((current !== null && current < 60) || (stressed !== null && stressed > 40))) return null;
      return {
        message: `Carteira em estresse: ${current ?? "n/d"}% em dia e ${stressed ?? "n/d"}% em carência + inadimplência.`,
        confidence: confidence(snapshot, ["currentAssetsPercent", "graceAssetsPercent", "defaultedAssetsPercent"]),
        evidenceMetrics: ["currentAssetsPercent", "graceAssetsPercent", "defaultedAssetsPercent"],
      };
    },
  },
  {
    id: "HY-002",
    version: VERSION,
    title: "Deterioração material do crédito",
    description: "Percentual em dia abaixo de 30% ou inadimplência acima de 10%.",
    families: ["credit_high_yield", "fiagro_credit", "fiinfra_credit"],
    dimension: "deterioration",
    alert: "orange",
    weight: 55,
    evaluate: ({ snapshot }) => {
      const current = numberMetric(snapshot, "currentAssetsPercent");
      const defaulted = numberMetric(snapshot, "defaultedAssetsPercent");
      if (!((current !== null && current < 30) || (defaulted !== null && defaulted > 10))) return null;
      return {
        message: `Deterioração material: ${current ?? "n/d"}% em dia e ${defaulted ?? "n/d"}% inadimplente.`,
        confidence: confidence(snapshot, ["currentAssetsPercent", "defaultedAssetsPercent"]),
        evidenceMetrics: ["currentAssetsPercent", "defaultedAssetsPercent"],
      };
    },
  },
  {
    id: "HY-003",
    version: VERSION,
    title: "Distribuição sem resultado no período",
    description: "Mês sem resultado caixa com distribuição mantida.",
    families: ["credit_high_yield", "fiagro_credit", "fiinfra_credit"],
    dimension: "deterioration",
    alert: "red",
    weight: 100,
    evaluate: ({ snapshot }) => {
      const cash = numberMetric(snapshot, "cashResultPerShare");
      const dividend = numberMetric(snapshot, "dividendPerShare");
      if (!(cash !== null && cash <= 0 && dividend !== null && dividend > 0)) return null;
      return {
        message: `Distribuição de R$ ${dividend.toFixed(2)}/cota sem resultado caixa positivo no período.`,
        confidence: confidence(snapshot, ["cashResultPerShare", "dividendPerShare"]),
        evidenceMetrics: ["cashResultPerShare", "dividendPerShare"],
      };
    },
  },
  {
    id: "HY-004",
    version: VERSION,
    title: "Cobertura insuficiente em carteira estressada",
    description: "Dividendos não cobertos por caixa quando mais de metade da carteira está em carência ou inadimplência.",
    families: ["credit_high_yield", "fiagro_credit", "fiinfra_credit"],
    dimension: "deterioration",
    alert: "orange",
    weight: 45,
    evaluate: ({ snapshot }) => {
      const ratio = coverage(snapshot);
      const grace = numberMetric(snapshot, "graceAssetsPercent");
      const defaulted = numberMetric(snapshot, "defaultedAssetsPercent");
      const stressed = grace !== null && defaulted !== null ? grace + defaulted : null;
      if (!(ratio !== null && ratio < 1 && stressed !== null && stressed > 50)) return null;
      return {
        message: `Cobertura de caixa em ${(ratio * 100).toFixed(1)}% com ${stressed.toFixed(1)}% da carteira estressada.`,
        confidence: confidence(snapshot, ["cashResultPerShare", "dividendPerShare", "graceAssetsPercent", "defaultedAssetsPercent"]),
        evidenceMetrics: ["cashResultPerShare", "dividendPerShare", "graceAssetsPercent", "defaultedAssetsPercent"],
      };
    },
  },
  {
    id: "DEV-001",
    version: VERSION,
    title: "Distribuição sem folga de caixa",
    description: "Distribuição semestral acima do resultado caixa com reserva igual ou inferior a R$ 0,10 por cota.",
    families: ["development_equity", "fiagro_land_equity"],
    dimension: "deterioration",
    alert: "yellow",
    weight: 35,
    evaluate: ({ snapshot }) => {
      const cash = numberMetric(snapshot, "semesterCashResultPerShare");
      const distributions = numberMetric(snapshot, "semesterDistributionsPerShare");
      const reserve = numberMetric(snapshot, "reservePerShare");
      if (!(cash !== null && distributions !== null && distributions > cash && reserve !== null && reserve <= 0.1)) return null;
      return {
        message: `Semestre distribuiu R$ ${distributions.toFixed(2)}/cota para R$ ${cash.toFixed(2)}/cota de caixa, com reserva de R$ ${reserve.toFixed(2)}.`,
        confidence: confidence(snapshot, ["semesterCashResultPerShare", "semesterDistributionsPerShare", "reservePerShare"]),
        evidenceMetrics: ["semesterCashResultPerShare", "semesterDistributionsPerShare", "reservePerShare"],
      };
    },
  },
  {
    id: "DEV-002",
    version: VERSION,
    title: "Dependência de evento de liquidez atrasado",
    description: "Guidance ou cobertura de dividendos depende de desinvestimento ou recebimento material ainda não liquidado.",
    families: ["development_equity", "fiagro_land_equity"],
    dimension: "deterioration",
    alert: "orange",
    weight: 60,
    evaluate: ({ snapshot }) => {
      const dependency = booleanMetric(snapshot, "guidanceDependsOnLiquidityEvent");
      const delayed = booleanMetric(snapshot, "liquidityEventDelayed");
      if (!(dependency === true && delayed === true)) return null;
      return {
        message: "A geração de caixa projetada depende de evento de liquidez material que foi adiado.",
        confidence: confidence(snapshot, ["guidanceDependsOnLiquidityEvent", "liquidityEventDelayed"]),
        evidenceMetrics: ["guidanceDependsOnLiquidityEvent", "liquidityEventDelayed"],
      };
    },
  },
  {
    id: "DEV-003",
    version: VERSION,
    title: "Valor patrimonial sobe enquanto a cobertura de caixa cai",
    description: "Reavaliação patrimonial positiva coexistindo com distribuição acima do resultado caixa corrente.",
    families: ["development_equity", "fiagro_land_equity"],
    dimension: "deterioration",
    alert: "orange",
    weight: 50,
    evaluate: ({ snapshot }) => {
      const revaluation = booleanMetric(snapshot, "positiveNavRevaluation");
      const ratio = coverage(snapshot);
      if (!(revaluation === true && ratio !== null && ratio < 1)) return null;
      return {
        message: `O VP recebeu reavaliação positiva enquanto a cobertura corrente do dividendo ficou em ${(ratio * 100).toFixed(1)}%.`,
        confidence: confidence(snapshot, ["positiveNavRevaluation", "cashResultPerShare", "dividendPerShare"]),
        evidenceMetrics: ["positiveNavRevaluation", "cashResultPerShare", "dividendPerShare"],
      };
    },
  },
];
