import type { PremiumAIInsights } from "../../types/ai-insights";
import type { PremiumFundReport, PremiumManagerMode, PremiumPortfolioImpact, PremiumPortfolioProjection, PremiumRecommendation, PremiumRiskLabReadOnly, PremiumScenario, PremiumStressCase } from "../../types/premium-report";
import type { PublicFundData } from "../../types/regulatory";
import {
  PREMIUM_PEER_SCORE_KEYS,
  type PremiumPeerAggregate,
  type PremiumPeerSnapshot,
} from "@/types/premium-peer-snapshot";
import { buildPremiumPeerSnapshot } from "@/lib/reports/PremiumPeerSnapshot";
import type { FreeFundReport } from "../../types/reports";
import type { FundScores } from "../../types/scores";

export const PREMIUM_REPORT_VERSION = "2.0.0";

export type PremiumReportDraft = Omit<PremiumFundReport, "aiAnalysis" | "auditReceipt">;
export type PremiumReportWithoutReceipt = Omit<PremiumFundReport, "auditReceipt">;

export type PremiumPortfolioHolding = {
  ticker: string;
  quotas: number;
  fund: PublicFundData | null;
};

export class PremiumReportError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 500) {
    super(message);
    this.name = "PremiumReportError";
    this.code = code;
    this.status = status;
  }
}

const SCORE_KEYS = ["risk", "dividend", "governance", "growth", "liquidity", "quality", "premium"] as const;
type ScoreKey = typeof SCORE_KEYS[number];

function numberValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let normalized = value.replace(/R\$|%|\s/g, "");
  if (!normalized || normalized === "-") return null;
  if (normalized.includes(",")) normalized = normalized.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number | null, digits = 2) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clampScore(value: number | null) {
  return value === null ? null : Math.round(Math.max(0, Math.min(100, value)));
}

function annualizedYield(monthlyDividend: number | null, price: number | null) {
  return monthlyDividend !== null && price !== null && price > 0 ? round((monthlyDividend * 12 / price) * 100) : null;
}

function valuation(report: FreeFundReport) {
  const price = numberValue(report.market.price);
  const pvp = report.market.pvp;
  const estimatedNavPerShare = price !== null && pvp !== null && pvp > 0 ? round(price / pvp) : null;
  const premiumDiscountPercent = pvp !== null ? round((pvp - 1) * 100) : null;
  const assessment = pvp === null ? "insufficient" as const : pvp < 0.95 ? "discount" as const : pvp > 1.05 ? "premium" as const : "fair" as const;
  const explanation = assessment === "insufficient"
    ? "P/VP insuficiente para estimar a relação entre preço e valor patrimonial."
    : assessment === "discount"
      ? "A cota está abaixo do valor patrimonial estimado; o desconto deve ser investigado, não interpretado isoladamente como oportunidade."
      : assessment === "premium"
        ? "A cota está acima do valor patrimonial estimado, reduzindo a margem de segurança contábil."
        : "A cotação está próxima do valor patrimonial estimado.";
  return { price, pvp, estimatedNavPerShare, premiumDiscountPercent, assessment, explanation };
}

function stressTest(report: FreeFundReport): PremiumStressCase[] {
  const price = numberValue(report.market.price);
  const dividend = report.market.lastDividend;
  const baseScore = report.scores?.premium.score ?? null;
  const cases = [
    { id: "mild" as const, label: "Estresse leve", priceShockPercent: -10, dividendShockPercent: -10, riskPenalty: 2, explanation: "Simula uma piora moderada para medir quanto a posição e a renda suportariam. Não é previsão." },
    { id: "moderate" as const, label: "Estresse moderado", priceShockPercent: -20, dividendShockPercent: -15, riskPenalty: 5, explanation: "Simula uma queda mais relevante de preço e renda para dimensionar o impacto financeiro." },
    { id: "severe" as const, label: "Estresse severo", priceShockPercent: -30, dividendShockPercent: -25, riskPenalty: 10, explanation: "Simula uma situação extrema para mostrar a perda potencial se preço e dividendos piorarem juntos." },
  ];
  return cases.map((item) => {
    const stressedPrice = price === null ? null : round(price * (1 + item.priceShockPercent / 100));
    const stressedMonthlyDividend = dividend === null ? null : round(dividend * (1 + item.dividendShockPercent / 100), 4);
    return {
      id: item.id,
      label: item.label,
      priceShockPercent: item.priceShockPercent,
      dividendShockPercent: item.dividendShockPercent,
      stressedPrice,
      stressedMonthlyDividend,
      annualizedYieldPercent: annualizedYield(stressedMonthlyDividend, stressedPrice),
      estimatedScore: clampScore(baseScore === null ? null : baseScore + item.dividendShockPercent * 0.4 - item.riskPenalty),
      explanation: item.explanation,
    };
  });
}

function scenarios(report: FreeFundReport): PremiumScenario[] {
  const price = numberValue(report.market.price);
  const dividend = report.market.lastDividend;
  const definitions = [
    { id: "positive" as const, label: "Cenário favorável (sensibilidade positiva)", price: 10, dividend: 5, assumptions: ["Cotação +10%", "Rendimento mensal +5%", "Sem mudança estrutural adicional"], explanation: "Mostra como preço, renda e posição mudariam se os dois indicadores melhorassem. É uma simulação, não uma previsão." },
    { id: "base" as const, label: "Cenário de referência (base estática)", price: 0, dividend: 0, assumptions: ["Cotação constante", "Rendimento mensal constante", "Manutenção dos dados atuais"], explanation: "Mantém os números atuais para servir de referência. Não afirma que o fundo permanecerá estável." },
    { id: "adverse" as const, label: "Cenário desfavorável (sensibilidade adversa)", price: -15, dividend: -20, assumptions: ["Cotação -15%", "Rendimento mensal -20%", "Sem recuperação automática presumida"], explanation: "Mostra o efeito de uma piora simultânea no preço e nos dividendos. Ajuda a estimar quanto a carteira perderia nesse teste." },
  ];
  return definitions.map((item) => {
    const projectedPrice = price === null ? null : round(price * (1 + item.price / 100));
    const projectedMonthlyDividend = dividend === null ? null : round(dividend * (1 + item.dividend / 100), 4);
    return {
      id: item.id,
      label: item.label,
      assumptions: item.assumptions,
      projectedPrice,
      projectedMonthlyDividend,
      projectedAnnualizedYieldPercent: annualizedYield(projectedMonthlyDividend, projectedPrice),
      explanation: item.explanation,
    };
  });
}

function emptyScores() {
  return Object.fromEntries(SCORE_KEYS.map((key) => [key, null])) as Record<ScoreKey, number | null>;
}

function normalizeGroupValue(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function selectPeerAggregate(report: FreeFundReport, snapshot: PremiumPeerSnapshot): PremiumPeerAggregate | null {
  const kind = report.identity.fundKind;
  const segment = normalizeGroupValue(report.identity.segment);
  const segmentGroup = segment
    ? snapshot.groups.find((group) => group.fundKind === kind && group.segment === segment)
    : null;
  const targetInSegment = segmentGroup?.premiumScores.some((item) => item.ticker === report.ticker) ? 1 : 0;
  if (segmentGroup && segmentGroup.memberCount - targetInSegment >= 3) return segmentGroup;
  return snapshot.kindGroups.find((group) => group.fundKind === kind) || null;
}

function comparative(report: FreeFundReport, snapshot: PremiumPeerSnapshot) {
  const aggregate = selectPeerAggregate(report, snapshot);
  const current = emptyScores();
  const peerAverage = emptyScores();
  const premiumPeers = aggregate?.premiumScores.filter((item) => item.ticker !== report.ticker).slice(0, 500) || [];
  const targetInGroup = aggregate?.premiumScores.some((item) => item.ticker === report.ticker) || false;
  for (const key of PREMIUM_PEER_SCORE_KEYS) {
    const currentScore = report.scores?.[key];
    const minimumConfidence = key === "premium" ? 25 : 35;
    current[key] = currentScore && currentScore.confidence >= minimumConfidence ? currentScore.score : null;
    const stats = aggregate?.scoreStats[key];
    const subtractCurrent = targetInGroup && currentScore && currentScore.confidence >= minimumConfidence;
    const count = Math.max(0, (stats?.count || 0) - (subtractCurrent ? 1 : 0));
    const sum = (stats?.sum || 0) - (subtractCurrent ? currentScore.score : 0);
    peerAverage[key] = count ? round(sum / count) : null;
  }
  const currentPremium = current.premium;
  const sampleReliable = currentPremium !== null && premiumPeers.length >= 5;
  const percentile = !sampleReliable
    ? null
    : Math.round((premiumPeers.filter((peer) => peer.score <= currentPremium).length / premiumPeers.length) * 100);
  const explanation = percentile === null
    ? `Foram encontrados ${premiumPeers.length} fundo(s) comparável(is) com confiança suficiente. São necessários pelo menos 5 para uma leitura responsável do percentil.`
    : `Percentil ${percentile}% significa que a nota composta ficou igual ou acima de ${percentile}% dos ${premiumPeers.length} pares analisados. Não mede rentabilidade futura nem garante que o fundo seja melhor investimento.`;
  return {
    peerGroup: aggregate?.segment ? `${report.identity.fundKind} · ${report.identity.segment}` : report.identity.fundKind,
    peerCount: premiumPeers.length,
    percentile,
    sampleReliable,
    explanation,
    current,
    peerAverage,
  };
}

function recommendations(report: FreeFundReport, valuationResult: ReturnType<typeof valuation>): PremiumRecommendation[] {
  const items: PremiumRecommendation[] = [];
  const scores = report.scores;
  if (scores) {
    const labels: Record<ScoreKey, string> = { risk: "risco", dividend: "dividendos", governance: "governança", growth: "crescimento", liquidity: "liquidez", quality: "qualidade dos dados", premium: "nota composta" };
    const actions: Record<Exclude<ScoreKey, "quality" | "premium">, string> = {
      risk: "Revisar os indicadores objetivos de risco antes de aumentar a exposição.",
      dividend: "Acompanhar estabilidade, volatilidade e eventuais cortes de dividendos.",
      governance: "Verificar sanções, incidentes, auditoria e decisões de assembleias.",
      growth: "Comparar a evolução dos rendimentos e do patrimônio nos próximos períodos.",
      liquidity: "Dimensionar a posição considerando a facilidade de saída em um mercado ruim.",
    };
    for (const key of (["risk", "dividend", "governance", "growth", "liquidity"] as const)) {
      const score = scores[key];
      if (score.confidence >= 35 && score.score < 45) {
        items.push({
          priority: score.score < 35 ? "high" : "medium",
          category: labels[key],
          action: actions[key],
          trigger: score.reasons[0] || `Score de ${labels[key]} abaixo do intervalo forte.`,
          rationale: `Nota ${score.score}/100 com confiança de ${score.confidence}%.`,
        });
      }
    }
  }
  if (valuationResult.assessment === "premium") items.push({ priority: "medium", category: "valuation", action: "Reavaliar a margem de segurança antes de novos aportes.", trigger: `P/VP de ${valuationResult.pvp}.`, rationale: valuationResult.explanation });
  if (valuationResult.assessment === "discount") items.push({ priority: "medium", category: "valuation", action: "Investigar a causa do desconto patrimonial e seus riscos antes de qualquer decisão.", trigger: `P/VP de ${valuationResult.pvp}.`, rationale: valuationResult.explanation });
  if (report.recentEvents.length) items.push({ priority: "low", category: "regulatório", action: "Revisar os eventos regulatórios mais recentes e seus efeitos nos próximos resultados.", trigger: report.recentEvents[0].title, rationale: `${report.recentEvents.length} evento(s) recente(s) compõem o relatório.` });
  if (!items.length) items.push({ priority: "low", category: "monitoramento", action: "Manter acompanhamento periódico de dividendos, documentos e scores.", trigger: "Nenhum alerta determinístico prioritário.", rationale: "Os dados disponíveis não indicaram ação de acompanhamento urgente." });
  return items.slice(0, 8);
}

function portfolioProjection(id: string, quotas: number, currentPrice: number | null, currentDividend: number | null, projectedPrice: number | null, projectedDividend: number | null): PremiumPortfolioProjection {
  const currentPositionValue = currentPrice === null ? null : quotas * currentPrice;
  const currentMonthlyIncome = currentDividend === null ? null : quotas * currentDividend;
  const projectedPositionValue = projectedPrice === null ? null : round(quotas * projectedPrice);
  const projectedMonthlyIncome = projectedDividend === null ? null : round(quotas * projectedDividend);
  return {
    id,
    projectedPositionValue,
    positionValueChange: projectedPositionValue === null || currentPositionValue === null ? null : round(projectedPositionValue - currentPositionValue),
    projectedMonthlyIncome,
    monthlyIncomeChange: projectedMonthlyIncome === null || currentMonthlyIncome === null ? null : round(projectedMonthlyIncome - currentMonthlyIncome),
  };
}

function portfolioImpact(report: FreeFundReport, holdings: PremiumPortfolioHolding[], stressCases: PremiumStressCase[], scenarioCases: PremiumScenario[]): PremiumPortfolioImpact {
  const normalized = holdings.filter((holding) => Number.isFinite(holding.quotas) && holding.quotas > 0);
  const positions = normalized.map((holding) => {
    const price = numberValue(holding.fund?.price);
    return { ...holding, price, value: price === null ? null : holding.quotas * price };
  });
  const target = positions.find((holding) => holding.ticker.toUpperCase() === report.ticker.toUpperCase()) || null;
  const knownValues = positions.map((holding) => holding.value).filter((value): value is number => value !== null);
  const portfolioValue = knownValues.length ? round(knownValues.reduce((sum, value) => sum + value, 0)) : null;
  const currentPrice = numberValue(report.market.price);
  const currentDividend = report.market.lastDividend;
  const currentPositionValue = target && currentPrice !== null ? round(target.quotas * currentPrice) : null;
  const estimatedMonthlyIncome = target && currentDividend !== null ? round(target.quotas * currentDividend) : null;
  const portfolioWeightPercent = currentPositionValue !== null && portfolioValue !== null && portfolioValue > 0
    ? round((currentPositionValue / portfolioValue) * 100)
    : null;
  const summary = !target
    ? "Este fundo não foi encontrado na carteira salva neste navegador. Os cenários continuam disponíveis por cota, mas o impacto financeiro pessoal não pode ser calculado."
    : portfolioWeightPercent === null
      ? `A carteira informa ${target.quotas} cota(s) deste fundo, mas faltam cotações para calcular sua participação no patrimônio.`
      : `${report.ticker} representa aproximadamente ${portfolioWeightPercent}% do patrimônio estimado entre as posições com cotação. Quanto maior esse peso, maior o efeito dos cenários sobre a carteira.`;
  return {
    available: Boolean(target && currentPositionValue !== null),
    holdingQuotas: target?.quotas ?? null,
    currentPositionValue,
    estimatedMonthlyIncome,
    portfolioValue,
    portfolioWeightPercent,
    coveredHoldings: knownValues.length,
    totalHoldings: positions.length,
    summary,
    stressTests: target ? stressCases.map((item) => portfolioProjection(item.id, target.quotas, currentPrice, currentDividend, item.stressedPrice, item.stressedMonthlyDividend)) : [],
    scenarios: target ? scenarioCases.map((item) => portfolioProjection(item.id, target.quotas, currentPrice, currentDividend, item.projectedPrice, item.projectedMonthlyDividend)) : [],
  };
}

function unavailableRiskLab(): PremiumRiskLabReadOnly {
  return {
    schemaVersion: 1,
    mode: "read_only",
    registryVersion: "premium-readonly-v1",
    rulesetVersion: "0.2.0",
    datasetId: "risk-lab-credit-oos-phase-c-v1",
    datasetHash: "f18f61b7ddb5cc63955fa9791c6e5e3e43552134aaa28a9dd622a96ee587fcae",
    evidenceHash: "fd695ecf4cbc759f9953ddcaf15ef14f28ba43a0b3d74098dd5cd1938baa9c81",
    availability: "disabled",
    applicabilityCategory: "unknown",
    categoryPolicyVersion: "risk-lab-category-policy-v1",
    categoryCalibrated: false,
    groundTruthStatus: null,
    outcome: null,
    status: null,
    disposition: null,
    riskAlert: null,
    stressDetectedAt: null,
    recoveryDetectedAt: null,
    recoveryPercentOfBaseline: null,
    summary: "A leitura read-only do Risk Lab não foi fornecida ao motor Premium.",
    limitations: ["Nenhuma conclusão do Risk Lab foi inferida."],
    readOnly: true,
    notificationsAllowed: false,
    externalEffectsAllowed: false,
  };
}

function managerMode(
  report: FreeFundReport,
  comparativeResult: ReturnType<typeof comparative>,
  portfolioResult: PremiumPortfolioImpact,
  riskLab: PremiumRiskLabReadOnly,
): PremiumManagerMode {
  let score = 0;
  const availableInputs: string[] = [];
  const missingInputs: string[] = [];
  const objectiveReading: string[] = [];

  if (numberValue(report.market.price) !== null && report.market.pvp !== null) {
    score += 20;
    availableInputs.push("cotação e P/VP");
    objectiveReading.push(`P/VP de ${report.market.pvp} e ágio/desconto determinístico de ${report.analysis.valuation.premiumDiscountPercent ?? "indisponível"}%.`);
  } else missingInputs.push("cotação e/ou P/VP confiável");

  if (report.analysis.income.observations >= 6) {
    score += 20;
    availableInputs.push("histórico de rendimentos");
    objectiveReading.push(`${report.analysis.income.observations} observações de rendimentos sustentam a leitura de tendência ${report.analysis.income.trend}.`);
  } else missingInputs.push("histórico mínimo de seis rendimentos");

  if (report.scores?.premium && report.scores.premium.confidence >= 35) {
    score += 20;
    availableInputs.push("scores determinísticos confiáveis");
    objectiveReading.push(`Nota composta de ${report.scores.premium.score}/100 com confiança de ${report.scores.premium.confidence}%.`);
  } else missingInputs.push("score composto com confiança mínima");

  if (report.sources.length > 0) {
    score += 10;
    availableInputs.push("fontes rastreáveis");
  } else missingInputs.push("fontes rastreáveis");

  if (report.recentEvents.length > 0) {
    score += 10;
    availableInputs.push("eventos regulatórios recentes");
  } else missingInputs.push("eventos regulatórios recentes");

  if (comparativeResult.sampleReliable) {
    score += 10;
    availableInputs.push("amostra confiável de pares");
  } else missingInputs.push("amostra mínima de cinco pares confiáveis");

  if (portfolioResult.available) {
    score += 5;
    availableInputs.push("quantidade atual e peso estimado na carteira");
    objectiveReading.push(`Peso estimado de ${portfolioResult.portfolioWeightPercent ?? "indisponível"}% entre posições cobertas por cotação.`);
  } else missingInputs.push("posição atual calculável na carteira");

  if (riskLab.availability === "available" || riskLab.availability === "inconclusive") {
    score += 5;
    availableInputs.push("Risk Lab homologado");
    objectiveReading.push(`Risk Lab: ${riskLab.disposition ?? "inconclusivo"}; modo read-only e sem efeitos externos.`);
  } else missingInputs.push("caso pertencente à coorte homologada do Risk Lab");

  missingInputs.push("quantidade planejada por ativo", "preço médio do usuário", "aporte mensal disponível", "meta percentual por ativo");
  const dataQualityLevel = score >= 75 ? "high" as const : score >= 50 ? "medium" as const : "low" as const;
  return {
    version: "premium-manager-mode-v3",
    dataQualityScore: score,
    dataQualityLevel,
    availableInputs: Array.from(new Set(availableInputs)),
    missingInputs: Array.from(new Set(missingInputs)),
    objectiveReading,
    limitations: [
      "Sem quantidade planejada, preço médio, aporte e meta, o relatório não calcula ranking de compra nem próxima ordem.",
      "Os cenários medem sensibilidade e não representam previsão de preço ou renda.",
      "O Risk Lab usa uma coorte histórica homologada e não substitui diligência atual do fundo.",
    ],
    actionability: "monitoring_only",
    controlPrinciple: "Maior desconto para a meta ou para o VP não implica automaticamente melhor compra; qualidade, risco, valuation e gatilho devem ser avaliados em conjunto.",
  };
}

export class PremiumReportEngine {
  prepare(
    freeReport: FreeFundReport,
    peers: PremiumPeerSnapshot | PublicFundData[],
    generatedAt = new Date().toISOString(),
    holdings: PremiumPortfolioHolding[] = [],
    riskLab: PremiumRiskLabReadOnly = unavailableRiskLab(),
  ): PremiumReportDraft {
    const peerSnapshot = Array.isArray(peers)
      ? buildPremiumPeerSnapshot(peers.map((fund) => ({
          ticker: fund.ticker,
          fundKind: fund.fundKind,
          segment: String(fund.segment_new || fund.segment || fund.segmento || "").trim() || null,
          scores: fund.scores,
        })), generatedAt)
      : peers;
    const valuationResult = valuation(freeReport);
    const stressCases = stressTest(freeReport);
    const scenarioCases = scenarios(freeReport);
    const comparativeResult = comparative(freeReport, peerSnapshot);
    const portfolioResult = portfolioImpact(freeReport, holdings, stressCases, scenarioCases);
    return {
      reportVersion: PREMIUM_REPORT_VERSION,
      ticker: freeReport.ticker,
      generatedAt,
      freeReport,
      valuation: valuationResult,
      stressTest: stressCases,
      scenarios: scenarioCases,
      comparative: comparativeResult,
      portfolioImpact: portfolioResult,
      riskLab,
      managerMode: managerMode(freeReport, comparativeResult, portfolioResult, riskLab),
      recommendations: recommendations(freeReport, valuationResult),
      methodology: [
        "Valuation limitado à relação entre cotação e valor patrimonial estimado; não calcula preço-alvo.",
        "Stress tests e cenários são sensibilidades matemáticas, não previsões de mercado.",
        "Comparativos utilizam fundos da mesma categoria e, quando possível, do mesmo segmento.",
        "Risk Lab é consumido somente como leitura histórica homologada, sem notificações ou efeitos externos.",
        "Toda análise textual de IA é produzida depois dos cálculos determinísticos e não pode alterá-los.",
      ],
      disclaimer: [
        "Relatório informativo e educacional; não constitui recomendação individualizada de investimento.",
        "As recomendações são ações de monitoramento e diligência, não ordens de compra ou venda.",
        "Ausência de sinal do Risk Lab não significa ausência de risco, e recuperação informativa não significa oportunidade de compra.",
        "Cenários hipotéticos podem divergir materialmente dos resultados futuros.",
      ],
    };
  }

  complete(draft: PremiumReportDraft, aiAnalysis: PremiumAIInsights): PremiumReportWithoutReceipt {
    return { ...draft, aiAnalysis };
  }

  generate(freeReport: FreeFundReport, peers: PremiumPeerSnapshot | PublicFundData[], aiAnalysis: PremiumAIInsights, generatedAt = new Date().toISOString(), holdings: PremiumPortfolioHolding[] = []): PremiumReportWithoutReceipt {
    return this.complete(this.prepare(freeReport, peers, generatedAt, holdings), aiAnalysis);
  }
}

export const premiumReportEngine = new PremiumReportEngine();
