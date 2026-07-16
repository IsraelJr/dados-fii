import type { PublicFundData } from "../../types/regulatory";
import type { FundScores, ScoreLevel, ScoreMetric, ScoreResult } from "../../types/scores";
import { confirmedDailyLiquidity } from "../market/StatusInvestParser";

export const SCORE_ENGINE_VERSION = "1.2.0";

type NumericRecord = Record<string, unknown>;

function clamp(value: number) {
  return Math.round(Math.max(0, Math.min(100, value)));
}

function level(score: number): ScoreLevel {
  if (score < 25) return "critical";
  if (score < 45) return "weak";
  if (score < 65) return "fair";
  if (score < 85) return "strong";
  return "excellent";
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  let normalized = value.replace(/R\$|%|\s/g, "");
  if (!normalized || normalized === "-") return null;
  if (normalized.includes(",")) normalized = normalized.replace(/\./g, "").replace(",", ".");
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

function firstNumber(data: NumericRecord, keys: string[]) {
  for (const key of keys) {
    const value = numberValue(data[key]);
    if (value !== null) return value;
  }
  return null;
}

export function plausibleDailyLiquidity(value: unknown) {
  const parsed = numberValue(value);
  return parsed !== null && parsed >= 1_000 ? parsed : null;
}

function firstDailyLiquidity(data: NumericRecord, keys: string[]) {
  for (const key of keys) {
    const value = plausibleDailyLiquidity(data[key]);
    if (value !== null) return value;
  }
  return null;
}

function firstValue(data: NumericRecord, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (value !== null && value !== undefined && value !== "") return value;
  }
  return null;
}

function firstBoolean(data: NumericRecord, keys: string[]) {
  for (const key of keys) {
    if (typeof data[key] === "boolean") return data[key] as boolean;
  }
  return null;
}

function confidence(available: number, expected: number) {
  return clamp((available / expected) * 100);
}

function result(score: number, available: number, expected: number, reasons: string[], metrics: Record<string, ScoreMetric>): ScoreResult {
  const normalized = clamp(score);
  return { score: normalized, confidence: confidence(available, expected), level: level(normalized), reasons, metrics };
}

function annualDividends(data: NumericRecord) {
  return Object.entries(data)
    .filter(([key, value]) => /^earnings\d{4}$/.test(key) && value && typeof value === "object" && !Array.isArray(value))
    .map(([key, value]) => {
      const payments = Object.values(value as NumericRecord)
        .map((entry) => entry && typeof entry === "object" ? numberValue((entry as NumericRecord).earnings) : numberValue(entry))
        .filter((entry): entry is number => entry !== null && entry >= 0);
      return { year: Number(key.slice(-4)), total: payments.reduce((sum, item) => sum + item, 0), months: payments.filter((item) => item > 0).length };
    })
    .filter((item) => item.year > 2000)
    .sort((a, b) => a.year - b.year);
}

function riskScore(data: NumericRecord): ScoreResult {
  const volatility = firstNumber(data, ["volatility12m", "volatility", "volatilidade"]);
  const vacancy = firstNumber(data, ["vacancy", "physicalVacancy", "vacanciaFisica", "vacância"]);
  const ltv = firstNumber(data, ["ltv", "loanToValue"]);
  const defaults = firstNumber(data, ["defaultRate", "inadimplencia", "inadimplência"]);
  const metrics = [volatility, vacancy, ltv, defaults];
  const available = metrics.filter((item) => item !== null).length;
  if (!available) return result(50, 0, 4, ["Dados de risco ainda insuficientes; aplicada nota neutra."], { volatility, vacancy, ltv, defaults });
  let score = 100;
  if (volatility !== null) score -= Math.min(45, Math.max(0, volatility) * 1.5);
  if (vacancy !== null) score -= Math.min(35, Math.max(0, vacancy) * 1.4);
  if (ltv !== null) score -= Math.min(40, Math.max(0, ltv - 20) * 0.8);
  if (defaults !== null) score -= Math.min(50, Math.max(0, defaults) * 3);
  const reasons = [
    volatility !== null ? `Volatilidade considerada: ${volatility.toFixed(1)}%.` : "Volatilidade não informada.",
    vacancy !== null ? `Vacância considerada: ${vacancy.toFixed(1)}%.` : "Vacância não informada.",
    ltv !== null ? `Alavancagem LTV considerada: ${ltv.toFixed(1)}%.` : "LTV não informado.",
  ];
  return result(score, available, 4, reasons, { volatility, vacancy, ltv, defaults });
}

function dividendScore(data: NumericRecord): ScoreResult {
  const dy = firstNumber(data, ["dividendYield12m", "dy12m", "dividendYield", "dy"]);
  const history = annualDividends(data);
  const last = history.at(-1) || null;
  const previous = history.at(-2) || null;
  const growth = last && previous && previous.total > 0 ? ((last.total / previous.total) - 1) * 100 : null;
  const available = Number(dy !== null) + Number(Boolean(last)) + Number(growth !== null);
  let score = 50;
  if (dy !== null) score += dy >= 7 && dy <= 14 ? 25 : dy >= 5 && dy <= 18 ? 12 : -12;
  if (last) score += last.months >= 12 ? 20 : last.months >= 9 ? 10 : -10;
  if (growth !== null) score += growth >= 0 ? Math.min(15, growth / 2 + 5) : Math.max(-25, growth);
  return result(score, available, 3, [
    dy !== null ? `Dividend yield de ${dy.toFixed(2)}% considerado.` : "Dividend yield não informado.",
    last ? `${last.months} meses com rendimentos no último ano disponível.` : "Histórico anual de rendimentos indisponível.",
    growth !== null ? `Variação anual de rendimentos: ${growth.toFixed(1)}%.` : "Sem dois anos comparáveis de rendimentos.",
  ], { dividendYield12m: dy, paidMonths: last?.months ?? null, annualGrowth: growth });
}

function governanceScore(data: NumericRecord): ScoreResult {
  const sanctions = firstNumber(data, ["regulatorySanctions12m", "governanceSanctions12m", "sancoesRegulatorias12m"]);
  const incidents = firstNumber(data, ["governanceIncidents12m", "governanceControversies12m", "incidentesGovernanca12m"]);
  const assemblyParticipation = firstNumber(data, ["assemblyParticipationPercent", "shareholderMeetingParticipation", "participacaoAssembleias"]);
  const unqualifiedAudit = firstBoolean(data, ["independentAuditUnqualified", "unqualifiedAuditOpinion", "auditoriaSemRessalvas"]);
  const relatedPartyDisclosure = firstBoolean(data, ["relatedPartyDisclosure", "relatedPartiesDisclosed", "divulgacaoPartesRelacionadas"]);
  const available = [sanctions, incidents, assemblyParticipation, unqualifiedAudit, relatedPartyDisclosure]
    .filter((item) => item !== null).length;
  const metrics = { sanctions, incidents, assemblyParticipation, unqualifiedAudit, relatedPartyDisclosure };
  if (!available) return result(50, 0, 5, [
    "Gestor e administrador identificados são dados cadastrais e não qualificam a governança.",
    "Sem evidências objetivas de governança; aplicada nota neutra.",
  ], metrics);

  let score = 50;
  if (sanctions !== null) score += sanctions === 0 ? 15 : -Math.min(45, sanctions * 15);
  if (incidents !== null) score += incidents === 0 ? 15 : -Math.min(35, incidents * 12);
  if (assemblyParticipation !== null) score += assemblyParticipation >= 30 ? 10 : assemblyParticipation >= 10 ? 3 : -8;
  if (unqualifiedAudit !== null) score += unqualifiedAudit ? 10 : -15;
  if (relatedPartyDisclosure !== null) score += relatedPartyDisclosure ? 10 : -10;
  return result(score, available, 5, [
    sanctions !== null ? `${sanctions} sanção(ões) regulatória(s) informada(s) em 12 meses.` : "Sanções regulatórias não avaliadas.",
    incidents !== null ? `${incidents} incidente(s) de governança informado(s) em 12 meses.` : "Incidentes de governança não avaliados.",
    assemblyParticipation !== null ? `Participação em assembleias considerada: ${assemblyParticipation.toFixed(1)}%.` : "Participação em assembleias não avaliada.",
  ], metrics);
}

function growthScore(data: NumericRecord): ScoreResult {
  const history = annualDividends(data).filter((item) => item.months >= 6);
  const first = history[0] || null;
  const last = history.at(-1) || null;
  const periods = first && last ? last.year - first.year : 0;
  const cagr = first && last && periods > 0 && first.total > 0 ? (Math.pow(last.total / first.total, 1 / periods) - 1) * 100 : null;
  const navGrowth = firstNumber(data, ["navGrowth12m", "patrimonyGrowth12m", "crescimentoPatrimonial"]);
  const available = Number(cagr !== null) + Number(navGrowth !== null);
  if (!available) return result(50, 0, 2, ["Série histórica insuficiente para medir crescimento."], { dividendCagr: null, navGrowth });
  let score = 50;
  if (cagr !== null) score += Math.max(-35, Math.min(35, cagr * 2.5));
  if (navGrowth !== null) score += Math.max(-20, Math.min(20, navGrowth));
  return result(score, available, 2, [
    cagr !== null ? `Crescimento anual composto dos rendimentos: ${cagr.toFixed(1)}%.` : "CAGR de rendimentos indisponível.",
    navGrowth !== null ? `Crescimento patrimonial em 12 meses: ${navGrowth.toFixed(1)}%.` : "Crescimento patrimonial não informado.",
  ], { dividendCagr: cagr, navGrowth, years: periods || null });
}

function liquidityScore(data: NumericRecord): ScoreResult {
  const daily = confirmedDailyLiquidity(data) ?? firstDailyLiquidity(data, ["averageDailyLiquidity", "dailyLiquidity", "liquidezMediaDiaria", "liquidity"]);
  const marketCap = firstNumber(data, ["marketCap", "valorDeMercado", "marketValue"]);
  const holders = firstNumber(data, ["shareholders", "holders", "cotistas"]);
  const available = [daily, marketCap, holders].filter((item) => item !== null).length;
  if (!available) return result(50, 0, 3, ["Dados de liquidez ainda insuficientes; aplicada nota neutra."], { dailyLiquidity: daily, marketCap, holders });
  let score = 0;
  if (daily !== null) score += Math.min(50, Math.log10(Math.max(1, daily)) / 7 * 50);
  else score += 25;
  if (marketCap !== null) score += Math.min(30, Math.log10(Math.max(1, marketCap)) / 10 * 30);
  else score += 15;
  if (holders !== null) score += Math.min(20, Math.log10(Math.max(1, holders)) / 6 * 20);
  else score += 10;
  return result(score, available, 3, [
    daily !== null ? `Liquidez média diária considerada: R$ ${daily.toLocaleString("pt-BR")}.` : "Liquidez média diária não informada.",
    marketCap !== null ? "Valor de mercado considerado." : "Valor de mercado não informado.",
    holders !== null ? `${Math.round(holders).toLocaleString("pt-BR")} cotistas considerados.` : "Número de cotistas não informado.",
  ], { dailyLiquidity: daily, marketCap, holders });
}

function qualityScore(data: NumericRecord): ScoreResult {
  const checks = {
    name: Boolean(firstValue(data, ["name", "fundName", "fantasyName", "nome"])),
    cnpj: Boolean(firstValue(data, ["cnpj", "CNPJ"])),
    segment: Boolean(firstValue(data, ["segment", "segmento", "sector"])),
    manager: Boolean(firstValue(data, ["manager", "gestor", "management"])),
    administrator: Boolean(firstValue(data, ["administrator", "administrador", "admin"])),
    kind: Boolean(firstValue(data, ["fundKind", "kind", "type"])),
    price: numberValue(data.price) !== null,
    earnings: annualDividends(data).length > 0,
  };
  const complete = Object.values(checks).filter(Boolean).length;
  const score = complete / Object.keys(checks).length * 100;
  return result(score, complete, Object.keys(checks).length, [
    `${complete} de ${Object.keys(checks).length} grupos essenciais de dados estão preenchidos.`,
    checks.cnpj && checks.name ? "Identificação cadastral disponível." : "Identificação cadastral incompleta.",
    checks.earnings ? "Histórico de rendimentos disponível." : "Histórico de rendimentos ausente.",
  ], checks);
}

function premiumScore(parts: Omit<FundScores, "engineVersion" | "generatedAt" | "premium">): ScoreResult {
  const weights = { risk: 0.25, dividend: 0.2, governance: 0.15, growth: 0.1, liquidity: 0.1, quality: 0.2 } as const;
  const score = Object.entries(weights).reduce((total, [key, weight]) => total + parts[key as keyof typeof weights].score * weight, 0);
  const confidenceScore = Object.entries(weights).reduce((total, [key, weight]) => total + parts[key as keyof typeof weights].confidence * weight, 0);
  return result(score, confidenceScore, 100, [
    "Nota composta calculada exclusivamente pelo ScoreEngine.",
    "Pesos: risco 25%, dividendos 20%, qualidade 20%, governança 15%, crescimento 10% e liquidez 10%.",
  ], Object.fromEntries(Object.keys(weights).map((key) => [key, parts[key as keyof typeof weights].score])));
}

export class ScoreEngine {
  calculate(fund: PublicFundData | NumericRecord, generatedAt = new Date().toISOString()): FundScores {
    const data = fund as NumericRecord;
    const parts = {
      risk: riskScore(data),
      dividend: dividendScore(data),
      governance: governanceScore(data),
      growth: growthScore(data),
      liquidity: liquidityScore(data),
      quality: qualityScore(data),
    };
    return {
      engineVersion: SCORE_ENGINE_VERSION,
      generatedAt,
      ...parts,
      premium: premiumScore(parts),
    };
  }

  healthCheck() {
    try {
      const scores = this.calculate({
        ticker: "HEALTH11",
        code: "HEALTH11",
        fundKind: "FII",
        name: "Health Check",
        segment: "Teste",
        price: 100,
        dividendYield12m: 10,
        dailyLiquidity: 1_000_000,
        regulatoryMeta: { currentVersion: 1, sources: [{ provider: "self-check", kind: "manual" }], validation: { valid: true, issues: [] } },
      });
      const required = ["risk", "dividend", "governance", "growth", "liquidity", "quality", "premium"] as const;
      const ok = required.every((key) => Number.isFinite(scores[key].score) && scores[key].score >= 0 && scores[key].score <= 100);
      return { ok, version: SCORE_ENGINE_VERSION, generatedScores: required.length, ...(ok ? {} : { error: "Score fora do intervalo de 0 a 100." }) };
    } catch (error) {
      return { ok: false, version: SCORE_ENGINE_VERSION, generatedScores: 0, error: error instanceof Error ? error.message : "Falha desconhecida no ScoreEngine." };
    }
  }
}

export const scoreEngine = new ScoreEngine();
