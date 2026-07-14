import { calculateRegulatoryScores, type ScoreValue } from "../services/score/index.ts";

export type RegulatoryScore = ScoreValue;

export type RegulatoryInsightSnapshot = {
  referenceDate: string;
  fundName?: string | null;
  netWorth?: number | null;
  sharesOutstanding?: number | null;
  numberShareholders?: number | null;
  vpCota?: number | null;
  totalPortfolioValue?: number | null;
  delinquentCreditValue?: number | null;
};

export type RegulatoryInsight = {
  code: string;
  severity: "positive" | "neutral" | "attention" | "risk";
  title: string;
  detail: string;
  metric?: string;
  value?: number | null;
};

function numeric(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function percentChange(first: unknown, last: unknown) {
  const start = numeric(first);
  const end = numeric(last);
  if (start === null || end === null || start === 0) return null;
  return Number((((end - start) / Math.abs(start)) * 100).toFixed(2));
}

function trendLabel(value: number | null, stableBand = 1) {
  if (value === null) return "indisponível";
  if (value > stableBand) return "alta";
  if (value < -stableBand) return "queda";
  return "estável";
}

export function buildRegulatoryInsights(input: {
  ticker: string;
  monthlyHistory: RegulatoryInsightSnapshot[];
  quality?: { coverage?: number; conflictCount?: number; qaScore?: number; documents?: number } | null;
  documents?: Array<Record<string, any>>;
}) {
  const history = [...(input.monthlyHistory || [])]
    .filter((item) => item?.referenceDate)
    .sort((left, right) => left.referenceDate.localeCompare(right.referenceDate));
  const documents = Array.isArray(input.documents) ? input.documents : [];
  const first = history[0] || null;
  const latest = history.at(-1) || null;
  const netWorthChangePct = percentChange(first?.netWorth, latest?.netWorth);
  const shareholdersChangePct = percentChange(first?.numberShareholders, latest?.numberShareholders);
  const vpCotaChangePct = percentChange(first?.vpCota, latest?.vpCota);
  const sharesChangePct = percentChange(first?.sharesOutstanding, latest?.sharesOutstanding);
  const delinquentValue = numeric(latest?.delinquentCreditValue);
  const coverage = numeric(input.quality?.coverage) ?? 0;
  const conflictCount = numeric(input.quality?.conflictCount) ?? 0;
  const qaScore = numeric(input.quality?.qaScore) ?? 0;
  const documentsCount = Math.max(documents.length, numeric(input.quality?.documents) ?? 0);
  const documentTypes = new Set(
    documents
      .map((document) => String(document?.documentType || document?.category || "").trim().toUpperCase())
      .filter(Boolean)
  );

  const insights: RegulatoryInsight[] = [];

  if (history.length < 2) {
    insights.push({
      code: "INSUFFICIENT_HISTORY",
      severity: "attention",
      title: "Histórico ainda curto",
      detail: "Ainda não há competências suficientes para medir tendências regulatórias com segurança.",
    });
  }

  if (shareholdersChangePct !== null) {
    insights.push({
      code: "SHAREHOLDER_TREND",
      severity: shareholdersChangePct >= 5 ? "positive" : shareholdersChangePct <= -5 ? "attention" : "neutral",
      title: `Base de cotistas em ${trendLabel(shareholdersChangePct, 2)}`,
      detail: `A base de cotistas variou ${shareholdersChangePct.toFixed(2)}% entre ${first?.referenceDate} e ${latest?.referenceDate}.`,
      metric: "numberShareholders",
      value: shareholdersChangePct,
    });
  }

  if (netWorthChangePct !== null) {
    insights.push({
      code: "NET_WORTH_TREND",
      severity: netWorthChangePct >= 5 ? "positive" : netWorthChangePct <= -5 ? "attention" : "neutral",
      title: `Patrimônio líquido em ${trendLabel(netWorthChangePct, 2)}`,
      detail: `O patrimônio líquido variou ${netWorthChangePct.toFixed(2)}% no período analisado.`,
      metric: "netWorth",
      value: netWorthChangePct,
    });
  }

  if (vpCotaChangePct !== null) {
    insights.push({
      code: "VP_COTA_TREND",
      severity: vpCotaChangePct >= 2 ? "positive" : vpCotaChangePct <= -3 ? "attention" : "neutral",
      title: `VP por cota em ${trendLabel(vpCotaChangePct, 1)}`,
      detail: `O valor patrimonial por cota variou ${vpCotaChangePct.toFixed(2)}% no período.`,
      metric: "vpCota",
      value: vpCotaChangePct,
    });
  }

  if (sharesChangePct !== null && Math.abs(sharesChangePct) >= 5) {
    insights.push({
      code: "SHARE_ISSUANCE_CHANGE",
      severity: "attention",
      title: "Mudança relevante na quantidade de cotas",
      detail: `A quantidade de cotas variou ${sharesChangePct.toFixed(2)}%, sugerindo emissão, amortização ou reorganização que deve ser confrontada com os documentos oficiais.`,
      metric: "sharesOutstanding",
      value: sharesChangePct,
    });
  }

  if (delinquentValue !== null) {
    insights.push({
      code: "DELINQUENCY_STATUS",
      severity: delinquentValue > 0 ? "risk" : "positive",
      title: delinquentValue > 0 ? "Valor vencido informado" : "Sem vencidos informados",
      detail: delinquentValue > 0
        ? `A última competência informa ${delinquentValue} em créditos vencidos.`
        : "A última competência não informa créditos vencidos.",
      metric: "delinquentCreditValue",
      value: delinquentValue,
    });
  }

  const scoreResult = calculateRegulatoryScores({
    historyLength: history.length,
    coverage,
    conflictCount,
    qaScore,
    documentsCount,
    documentTypesCount: documentTypes.size,
    netWorthChangePct,
    shareholdersChangePct,
    vpCotaChangePct,
    delinquentValue,
  });
  const { scores } = scoreResult;

  const facts = {
    fundName: latest?.fundName || first?.fundName || null,
    firstReferenceDate: first?.referenceDate || null,
    latestReferenceDate: latest?.referenceDate || null,
    monthsAnalyzed: history.length,
    documentsAnalyzed: documentsCount,
    documentTypesAnalyzed: documentTypes.size,
    netWorthChangePct,
    shareholdersChangePct,
    vpCotaChangePct,
    sharesChangePct,
    latestNetWorth: numeric(latest?.netWorth),
    latestShareholders: numeric(latest?.numberShareholders),
    latestVpCota: numeric(latest?.vpCota),
    latestSharesOutstanding: numeric(latest?.sharesOutstanding),
    latestDelinquentCreditValue: delinquentValue,
  };

  return {
    ticker: String(input.ticker || "").toUpperCase(),
    generatedBy: "regulatory-insights-v2",
    methodologyVersion: 2,
    scoreEngine: {
      version: scoreResult.version,
      methodologyVersion: scoreResult.methodologyVersion,
      weights: scoreResult.weights,
    },
    semaphore: scoreResult.semaphore,
    assessedDimensions: scoreResult.assessedDimensions,
    unavailableDimensions: scoreResult.unavailableDimensions,
    facts,
    scores,
    insights,
    freeReport: {
      headline: history.length >= 2
        ? `${input.ticker}: patrimônio ${trendLabel(netWorthChangePct, 2)}, VP/cota ${trendLabel(vpCotaChangePct, 1)} e cotistas em ${trendLabel(shareholdersChangePct, 2)}.`
        : `${input.ticker}: dados regulatórios disponíveis, mas ainda sem histórico suficiente.`,
      keyMetrics: facts,
      alerts: insights.filter((item) => item.severity === "attention" || item.severity === "risk").slice(0, 3),
      semaphore: scoreResult.semaphore,
    },
    premiumInput: {
      facts,
      scores,
      insights,
      semaphore: scoreResult.semaphore,
      unavailableDimensions: scoreResult.unavailableDimensions,
      scoreEngine: {
        version: scoreResult.version,
        methodologyVersion: scoreResult.methodologyVersion,
      },
      instruction: "A IA deve interpretar somente estes fatos e os documentos oficiais anexados, sem inventar dados ausentes. Dimensões indisponíveis não podem receber nota estimada.",
    },
  };
}
