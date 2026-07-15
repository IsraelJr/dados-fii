import type { PublicFundData, ValidationIssue } from "../../types/regulatory";
import type { FreeFundReport, FreeReportSignal } from "../../types/reports";
import type { FundScores, ScoreResult } from "../../types/scores";
import type { RegulatoryTimelineResponse } from "../../types/timeline";
import { plausiblePvpValue } from "../fiiDerivedData";

export const FREE_REPORT_VERSION = "1.0.0";

const SCORE_LABELS: Record<Exclude<keyof FundScores, "engineVersion" | "generatedAt">, string> = {
  risk: "Risco",
  dividend: "Dividendos",
  governance: "Governança",
  growth: "Crescimento",
  liquidity: "Liquidez",
  quality: "Qualidade dos dados",
  premium: "Nota composta",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_PT: Record<string, string> = {
  January: "Janeiro", February: "Fevereiro", March: "Março", April: "Abril", May: "Maio", June: "Junho",
  July: "Julho", August: "Agosto", September: "Setembro", October: "Outubro", November: "Novembro", December: "Dezembro",
};

type Data = Record<string, unknown>;
type ScoreKey = Exclude<keyof FundScores, "engineVersion" | "generatedAt">;

function text(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let normalized = value.replace(/R\$|%|\s/g, "");
  if (!normalized || normalized === "-") return null;
  if (normalized.includes(",")) normalized = normalized.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function firstNumber(data: Data, keys: string[]) {
  for (const key of keys) {
    const parsed = numberValue(data[key]);
    if (parsed !== null) return parsed;
  }
  return null;
}

function firstPvp(data: Data, keys: string[]) {
  for (const key of keys) {
    const parsed = plausiblePvpValue(data[key]);
    if (parsed !== undefined) return parsed;
  }
  return null;
}

function firstText(data: Data, keys: string[]) {
  for (const key of keys) {
    const parsed = text(data[key]);
    if (parsed) return parsed;
  }
  return null;
}

function lastDividend(data: Data) {
  const years = Object.keys(data)
    .filter((key) => /^earnings\d{4}$/.test(key) && data[key] && typeof data[key] === "object" && !Array.isArray(data[key]))
    .sort((a, b) => Number(b.slice(-4)) - Number(a.slice(-4)));

  for (const yearKey of years) {
    const entries = data[yearKey] as Data;
    const ordered = Object.entries(entries).sort(([a], [b]) => MONTHS.indexOf(b) - MONTHS.indexOf(a));
    for (const [month, item] of ordered) {
      const value = item && typeof item === "object" ? numberValue((item as Data).earnings) : numberValue(item);
      if (value !== null && value > 0) return { value, reference: `${MONTHS_PT[month] || month}/${yearKey.slice(-4)}` };
    }
  }
  return { value: null, reference: null };
}

function signal(category: string, score: ScoreResult, detail?: string): FreeReportSignal {
  return {
    category,
    title: `${category}: ${score.score}/100`,
    detail: detail || score.reasons[0] || "Indicador calculado automaticamente.",
    level: score.level,
    score: score.score,
    confidence: score.confidence,
  };
}

function scoreEntries(scores: FundScores) {
  return (Object.keys(SCORE_LABELS) as ScoreKey[])
    .filter((key) => key !== "premium" && key !== "quality")
    .map((key) => ({ key, label: SCORE_LABELS[key], result: scores[key] }));
}

function buildHighlights(scores: FundScores | null, validationValid: boolean, sourceCount: number) {
  const items: FreeReportSignal[] = [];
  if (scores) {
    for (const item of scoreEntries(scores)
      .filter(({ result }) => result.score >= 65 && result.confidence >= 35)
      .sort((a, b) => b.result.score - a.result.score)
      .slice(0, 3)) {
      items.push(signal(item.label, item.result));
    }
  }
  if (validationValid) items.push({ category: "Validação", title: "Base regulatória validada", detail: "Nenhum erro bloqueante foi encontrado nos dados publicados.", level: "info" });
  if (sourceCount > 0) items.push({ category: "Rastreabilidade", title: `${sourceCount} fonte(s) identificada(s)`, detail: "As origens disponíveis acompanham o relatório para auditoria.", level: "info" });
  return items.slice(0, 4);
}

function buildAttentionPoints(scores: FundScores | null, issues: ValidationIssue[]) {
  const items: FreeReportSignal[] = issues.slice(0, 3).map((issue) => ({
    category: "Qualidade",
    title: issue.severity === "error" ? "Dado regulatório inválido" : "Dado regulatório incompleto",
    detail: issue.message,
    level: issue.severity === "error" ? "critical" : "fair",
  }));

  if (scores) {
    for (const item of scoreEntries(scores)
      .filter(({ result }) => result.score < 45 || result.confidence < 35)
      .sort((a, b) => a.result.score - b.result.score || a.result.confidence - b.result.confidence)) {
      const detail = item.result.confidence < 35
        ? `${item.result.reasons[0] || "Dados insuficientes."} Confiança do cálculo: ${item.result.confidence}%.`
        : item.result.reasons[0];
      items.push(signal(item.label, item.result, detail));
    }
  }

  return items.slice(0, 5);
}

export class FreeReportEngine {
  generate(fund: PublicFundData, timeline: RegulatoryTimelineResponse | null, generatedAt = new Date().toISOString()): FreeFundReport {
    const data = fund as Data;
    const issues = Array.isArray(fund.regulatoryMeta?.validation?.issues) ? fund.regulatoryMeta.validation.issues : [];
    const sources = Array.isArray(fund.regulatoryMeta?.sources) ? fund.regulatoryMeta.sources : [];
    const scores = fund.scores || null;
    const dividend = lastDividend(data);
    const validationValid = Boolean(fund.regulatoryMeta?.validation?.valid);

    return {
      reportVersion: FREE_REPORT_VERSION,
      ticker: fund.ticker,
      generatedAt,
      identity: {
        name: firstText(data, ["name", "fantasyName", "nome", "socialReason", "razao_social"]) || fund.ticker,
        corporateName: firstText(data, ["socialReason", "corporateName", "razaoSocial", "razao_social"]),
        cnpj: firstText(data, ["cnpj", "CNPJ"]),
        fundKind: fund.fundKind,
        segment: firstText(data, ["segment_new", "segment", "segmento", "sector"]),
        manager: firstText(data, ["manager", "gestor", "management"]),
        administrator: firstText(data, ["administrator", "administrador", "admin"]),
      },
      market: {
        price: typeof data.price === "string" || typeof data.price === "number" ? data.price : null,
        variation: typeof data.variation === "string" || typeof data.variation === "number" ? data.variation : null,
        dividendYield: firstNumber(data, ["dividendYield12m", "dy12m", "dividendYield", "dy"]),
        pvp: firstPvp(data, ["pvp", "p_vp", "pvpa", "priceToBook"]),
        lastDividend: dividend.value,
        lastDividendReference: dividend.reference,
      },
      scores,
      highlights: buildHighlights(scores, validationValid, sources.length),
      attentionPoints: buildAttentionPoints(scores, issues),
      dataQuality: {
        validationValid,
        errors: issues.filter((issue) => issue.severity === "error").length,
        warnings: issues.filter((issue) => issue.severity === "warning").length,
        sourceCount: sources.length,
        completenessScore: scores?.quality.score ?? null,
        completenessConfidence: scores?.quality.confidence ?? null,
      },
      recentEvents: (timeline?.items || []).slice(0, 5),
      sources,
      methodology: [
        "Relatório calculado automaticamente pelo RegulatoryDataService.",
        "Notas produzidas exclusivamente pelo ScoreEngine, sem edição manual.",
        "Eventos recentes consolidados pela Timeline Regulatória.",
      ],
      disclaimer: [
        "Conteúdo informativo; não constitui recomendação de compra, venda ou manutenção.",
        "Indicadores com baixa confiança refletem ausência ou incompletude dos dados disponíveis.",
        "Preços e indicadores de mercado podem apresentar defasagem em relação ao pregão.",
      ],
    };
  }
}

export const freeReportEngine = new FreeReportEngine();
