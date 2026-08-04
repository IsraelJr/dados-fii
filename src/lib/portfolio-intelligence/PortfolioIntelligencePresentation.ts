import type {
  PortfolioIntelligenceConfidence,
  PortfolioIntelligenceDataQualityReason,
  PortfolioIntelligenceQualityState,
  PortfolioIntelligenceResult,
  PortfolioIntelligenceSeverity,
  PortfolioIntelligenceSignal,
  PortfolioIntelligenceSignalCode,
} from "./PortfolioIntelligence";

export type PortfolioIntelligenceIncomeState = "rising" | "falling" | "stable" | "unavailable";
export type PortfolioIntelligenceViewState = "invalid" | "empty" | "insufficient_history" | "partial" | "complete";

export type PortfolioIntelligenceEvidenceView = Readonly<{
  key: string;
  label: string;
  value: string;
}>;

export type PortfolioIntelligenceSignalView = Readonly<{
  code: PortfolioIntelligenceSignalCode;
  title: string;
  summary: string;
  severity: PortfolioIntelligenceSeverity;
  severityLabel: string;
  confidence: PortfolioIntelligenceConfidence;
  confidenceLabel: string;
  evidence: readonly PortfolioIntelligenceEvidenceView[];
}>;

export type PortfolioIntelligencePresentation = Readonly<{
  state: PortfolioIntelligenceViewState;
  stateMessage: string;
  summary: Readonly<{
    incomeState: PortfolioIntelligenceIncomeState;
    incomeLabel: string;
    qualityState: PortfolioIntelligenceQualityState;
    qualityLabel: string;
    attentionCount: number;
    attentionLabel: string;
  }>;
  primarySignals: readonly PortfolioIntelligenceSignalView[];
  allSignals: readonly PortfolioIntelligenceSignalView[];
  hasMoreSignals: boolean;
  dataUsed: Readonly<{
    monthsLabel: string;
    positionsLabel: string;
    segmentCoverageLabel: string;
    incomeCoverageLabel: string;
    reasons: readonly Readonly<{
      code: PortfolioIntelligenceDataQualityReason["code"];
      impactLabel: string;
      message: string;
    }>[];
  }>;
}>;

const SIGNAL_TITLES: Readonly<Record<PortfolioIntelligenceSignalCode, string>> = Object.freeze({
  DADOS_INSUFICIENTES: "Dados ainda não sustentam toda a análise",
  CONCENTRACAO_ELEVADA: "Concentração patrimonial elevada",
  DEPENDENCIA_DE_UM_FUNDO: "Dependência de renda de um fundo",
  CONCENTRACAO_POR_SEGMENTO: "Concentração por segmento",
  RENDA_EM_QUEDA: "Renda recente em queda",
  RENDA_INSTAVEL: "Renda recente instável",
  MES_ATIPICO_NEGATIVO: "Mês atípico abaixo do padrão",
  RENDA_EM_ALTA: "Renda recente em alta",
  RENDA_ESTAVEL: "Renda recente estável",
  MES_ATIPICO_POSITIVO: "Mês atípico acima do padrão",
});

const EVIDENCE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  monthsAvailable: "Meses disponíveis",
  monthsRequired: "Meses necessários",
  pricedPositions: "Posições com cotação",
  totalPositions: "Total de posições",
  segmentCoveragePercent: "Cobertura de segmentos",
  incomeKnownPositions: "Posições com renda estimada",
  largestTicker: "Maior posição",
  largestPositionPercent: "Participação da maior posição",
  topThreePercent: "Participação das três maiores",
  hhi: "HHI patrimonial",
  ticker: "Fundo",
  estimatedIncome: "Renda estimada",
  sharePercent: "Participação",
  totalEstimatedIncome: "Renda estimada total",
  segment: "Segmento",
  coveragePercent: "Cobertura",
  previousAverage: "Média dos três meses anteriores",
  recentAverage: "Média dos três meses recentes",
  variationPercent: "Variação",
  sixMonthAverage: "Média de seis meses",
  populationStandardDeviation: "Desvio-padrão populacional",
  coefficientOfVariationPercent: "Coeficiente de variação",
  competence: "Competência",
  value: "Valor do mês",
  baselineMedian: "Mediana dos seis meses anteriores",
  mad: "MAD",
  robustScore: "Índice robusto",
  relativeDeviationPercent: "Desvio relativo",
});

const EVIDENCE_BY_SIGNAL: Readonly<Record<PortfolioIntelligenceSignalCode, readonly string[]>> = Object.freeze({
  DADOS_INSUFICIENTES: Object.freeze([
    "monthsAvailable",
    "monthsRequired",
    "pricedPositions",
    "totalPositions",
    "segmentCoveragePercent",
    "incomeKnownPositions",
  ]),
  CONCENTRACAO_ELEVADA: Object.freeze([
    "largestTicker",
    "largestPositionPercent",
    "topThreePercent",
    "hhi",
  ]),
  DEPENDENCIA_DE_UM_FUNDO: Object.freeze([
    "ticker",
    "estimatedIncome",
    "sharePercent",
    "totalEstimatedIncome",
  ]),
  CONCENTRACAO_POR_SEGMENTO: Object.freeze(["segment", "sharePercent", "coveragePercent"]),
  RENDA_EM_QUEDA: Object.freeze(["previousAverage", "recentAverage", "variationPercent"]),
  RENDA_INSTAVEL: Object.freeze([
    "sixMonthAverage",
    "populationStandardDeviation",
    "coefficientOfVariationPercent",
  ]),
  MES_ATIPICO_NEGATIVO: Object.freeze([
    "competence",
    "value",
    "baselineMedian",
    "mad",
    "robustScore",
    "relativeDeviationPercent",
  ]),
  RENDA_EM_ALTA: Object.freeze(["previousAverage", "recentAverage", "variationPercent"]),
  RENDA_ESTAVEL: Object.freeze(["previousAverage", "recentAverage", "variationPercent"]),
  MES_ATIPICO_POSITIVO: Object.freeze([
    "competence",
    "value",
    "baselineMedian",
    "mad",
    "robustScore",
    "relativeDeviationPercent",
  ]),
});

const CURRENCY_EVIDENCE = new Set([
  "estimatedIncome",
  "totalEstimatedIncome",
  "previousAverage",
  "recentAverage",
  "sixMonthAverage",
  "populationStandardDeviation",
  "value",
  "baselineMedian",
  "mad",
]);

const PERCENT_EVIDENCE = new Set([
  "segmentCoveragePercent",
  "largestPositionPercent",
  "topThreePercent",
  "sharePercent",
  "coveragePercent",
  "variationPercent",
  "coefficientOfVariationPercent",
  "relativeDeviationPercent",
]);

const COMPETENCE_MONTHS = Object.freeze([
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
]);

function formatNumber(value: number, maximumFractionDigits = 2) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits });
}

export function formatPortfolioIntelligenceCurrency(value: number | null) {
  if (value === null) return "Não disponível";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPortfolioIntelligencePercent(value: number | null) {
  if (value === null) return "Não disponível";
  return `${formatNumber(value)}%`;
}

export function formatPortfolioIntelligenceCompetence(value: string | null) {
  if (value === null) return "Não disponível";
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return value;
  return `${COMPETENCE_MONTHS[Number(match[2]) - 1]}/${match[1]}`;
}

function formatEvidenceValue(key: string, value: string | number | boolean | null) {
  if (value === null) return "Não disponível";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "number" && CURRENCY_EVIDENCE.has(key)) {
    return formatPortfolioIntelligenceCurrency(value);
  }
  if (typeof value === "number" && PERCENT_EVIDENCE.has(key)) {
    return formatPortfolioIntelligencePercent(value);
  }
  if (key === "competence" && typeof value === "string") {
    return formatPortfolioIntelligenceCompetence(value);
  }
  if (typeof value === "number") return formatNumber(value);
  return value;
}

function severityLabel(severity: PortfolioIntelligenceSeverity) {
  if (severity === "warning") return "Alerta";
  if (severity === "attention") return "Atenção";
  return "Informativo";
}

function confidenceLabel(confidence: PortfolioIntelligenceConfidence) {
  if (confidence === "high") return "Alta";
  if (confidence === "medium") return "Média";
  return "Baixa";
}

function signalView(signal: PortfolioIntelligenceSignal): PortfolioIntelligenceSignalView {
  const evidence = EVIDENCE_BY_SIGNAL[signal.code]
    .filter((key) => Object.prototype.hasOwnProperty.call(signal.evidence, key))
    .map((key) => Object.freeze({
      key,
      label: EVIDENCE_LABELS[key],
      value: formatEvidenceValue(key, signal.evidence[key]),
    }));
  return Object.freeze({
    code: signal.code,
    title: SIGNAL_TITLES[signal.code],
    summary: signal.summary,
    severity: signal.severity,
    severityLabel: severityLabel(signal.severity),
    confidence: signal.confidence,
    confidenceLabel: confidenceLabel(signal.confidence),
    evidence: Object.freeze(evidence),
  });
}

function incomeState(result: PortfolioIntelligenceResult): PortfolioIntelligenceIncomeState {
  if (result.signals.some((signal) => signal.code === "RENDA_EM_ALTA")) return "rising";
  if (result.signals.some((signal) => signal.code === "RENDA_EM_QUEDA")) return "falling";
  if (result.signals.some((signal) => signal.code === "RENDA_ESTAVEL")) return "stable";
  return "unavailable";
}

function viewState(result: PortfolioIntelligenceResult): PortfolioIntelligenceViewState {
  const reasonCodes = new Set(result.dataQuality.reasons.map((reason) => reason.code));
  if (reasonCodes.has("INVALID_INPUT_REJECTED")) return "invalid";
  if (reasonCodes.has("EMPTY_PORTFOLIO")) return "empty";
  if (reasonCodes.has("INSUFFICIENT_CLOSED_MONTHS")) return "insufficient_history";
  if (result.dataQuality.state === "sufficient") return "complete";
  return "partial";
}

const INCOME_LABELS: Readonly<Record<PortfolioIntelligenceIncomeState, string>> = Object.freeze({
  rising: "Alta",
  falling: "Queda",
  stable: "Estável",
  unavailable: "Indisponível",
});

const QUALITY_LABELS: Readonly<Record<PortfolioIntelligenceQualityState, string>> = Object.freeze({
  sufficient: "Suficiente",
  partial: "Parcial",
  insufficient: "Insuficiente",
});

const STATE_MESSAGES: Readonly<Record<PortfolioIntelligenceViewState, string>> = Object.freeze({
  invalid: "A análise não foi exibida porque a entrada foi rejeitada pelo modo seguro.",
  empty: "Adicione uma posição para avaliar concentração, segmentos e renda estimada.",
  insufficient_history: "O histórico encerrado ainda não é suficiente para calcular a tendência de renda.",
  partial: "A análise disponível é parcial; veja abaixo exatamente quais evidências faltam.",
  complete: "As conclusões abaixo usam todas as evidências exigidas pela política atual.",
});

export function buildPortfolioIntelligencePresentation(
  result: PortfolioIntelligenceResult,
): PortfolioIntelligencePresentation {
  const resolvedIncomeState = incomeState(result);
  const resolvedViewState = viewState(result);
  const allSignals = Object.freeze(result.signals.map(signalView));
  const primarySignals = Object.freeze(allSignals.slice(0, 3));
  const attentionCount = result.signals.filter((signal) => signal.severity !== "info").length;
  const totalPositions = result.metrics.portfolio.fundCount;
  const reasons = Object.freeze(result.dataQuality.reasons.map((reason) => Object.freeze({
    code: reason.code,
    impactLabel: reason.impact === "suppressed" ? "Conclusão indisponível" : "Confiança reduzida",
    message: reason.message,
  })));

  return Object.freeze({
    state: resolvedViewState,
    stateMessage: STATE_MESSAGES[resolvedViewState],
    summary: Object.freeze({
      incomeState: resolvedIncomeState,
      incomeLabel: INCOME_LABELS[resolvedIncomeState],
      qualityState: result.dataQuality.state,
      qualityLabel: QUALITY_LABELS[result.dataQuality.state],
      attentionCount,
      attentionLabel: attentionCount === 1 ? "1 ponto" : `${attentionCount} pontos`,
    }),
    primarySignals,
    allSignals,
    hasMoreSignals: allSignals.length > primarySignals.length,
    dataUsed: Object.freeze({
      monthsLabel: `${result.dataQuality.monthsAvailable} de ${result.dataQuality.monthsRequired} meses encerrados necessários`,
      positionsLabel: `${result.dataQuality.pricedPositionCount} com cotação e ${result.dataQuality.unpricedPositionCount} sem cotação, de ${totalPositions} posição(ões)`,
      segmentCoverageLabel: formatPortfolioIntelligencePercent(result.dataQuality.segmentCoveragePercent),
      incomeCoverageLabel: formatPortfolioIntelligencePercent(result.dataQuality.incomeCoveragePercent),
      reasons,
    }),
  });
}

export function visiblePortfolioIntelligenceSignals(
  presentation: PortfolioIntelligencePresentation,
  expanded: boolean,
) {
  return expanded ? presentation.allSignals : presentation.primarySignals;
}
