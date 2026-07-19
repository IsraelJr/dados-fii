import type {
  DividendStressWindow,
  VerifiedDividendNotice,
  VerifiedMaterialCreditEvent,
} from "../../types/riskLabDividendStress";

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const COMPARISON_EPSILON = 1e-12;
const ALLOWED_SOURCE_TYPES = new Set(["primary_regulatory", "primary_manager"]);
const ALLOWED_REVIEW_METHODS = new Set(["manual_document_review", "automatic_regulatory_validation"]);
const ALLOWED_PRIMARY_HOSTS = new Set([
  "fnet.bmfbovespa.com.br",
  "dados.cvm.gov.br",
  "www.mauacapital.com.br",
  "mauacapital.com.br",
  "www.rbrasset.com.br",
  "rbrasset.com.br",
]);

function monthIndex(value: string) {
  if (!MONTH_PATTERN.test(value)) throw new Error(`Competência mensal inválida: ${value}`);
  const [year, month] = value.split("-").map(Number);
  return year * 12 + month - 1;
}

function isIsoDate(value: string) {
  return !Number.isNaN(Date.parse(value));
}

function assertPrimaryUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`URL de fonte inválida: ${value}`);
  }
  if (url.protocol !== "https:" || !ALLOWED_PRIMARY_HOSTS.has(url.hostname)) {
    throw new Error(`Fonte de rendimento não é primária autorizada: ${url.hostname}`);
  }
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, digits = 6) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function contiguous(items: VerifiedDividendNotice[]) {
  for (let index = 1; index < items.length; index += 1) {
    if (monthIndex(items[index].competenceMonth) !== monthIndex(items[index - 1].competenceMonth) + 1) {
      return false;
    }
  }
  return true;
}

function validateNotice(notice: VerifiedDividendNotice, ticker: string) {
  if (notice.ticker !== ticker) throw new Error(`Ticker divergente na série: ${notice.ticker}`);
  monthIndex(notice.competenceMonth);
  if (!Number.isFinite(notice.amountPerShare) || notice.amountPerShare < 0) {
    throw new Error(`Rendimento inválido em ${notice.competenceMonth}`);
  }
  if (!isIsoDate(notice.announcedAt)) throw new Error(`Data de anúncio inválida em ${notice.competenceMonth}`);
  if (!notice.source.documentId.trim()) throw new Error(`Documento ausente em ${notice.competenceMonth}`);
  if (!ALLOWED_SOURCE_TYPES.has(notice.source.sourceType)) {
    throw new Error(`Tipo de fonte não autorizado em ${notice.competenceMonth}`);
  }
  assertPrimaryUrl(notice.source.sourceUrl);
  const reviewMethod = String((notice.source as unknown as { reviewMethod?: unknown }).reviewMethod || "");
  if (!ALLOWED_REVIEW_METHODS.has(reviewMethod)) {
    throw new Error(`Método de validação não autorizado em ${notice.competenceMonth}`);
  }
  if (reviewMethod === "automatic_regulatory_validation") {
    if (notice.source.sourceType !== "primary_regulatory" || !notice.source.reviewedBy.startsWith("risk-lab-")) {
      throw new Error(`Validação regulatória automática inválida em ${notice.competenceMonth}`);
    }
  }
  if (!notice.source.reviewedBy.trim() || !isIsoDate(notice.source.reviewedAt)) {
    throw new Error(`Metadados de revisão incompletos em ${notice.competenceMonth}`);
  }
  if (!notice.source.excerpt.trim()) throw new Error(`Trecho primário ausente em ${notice.competenceMonth}`);
}

function validateCreditEvent(event: VerifiedMaterialCreditEvent, ticker: string) {
  if (event.ticker !== ticker) throw new Error(`Ticker divergente em evento de crédito: ${event.ticker}`);
  if (!isIsoDate(event.knownAt) || !isIsoDate(event.reviewedAt)) {
    throw new Error(`Datas inválidas em evento de crédito ${event.documentId}`);
  }
  if (!event.documentId.trim() || !event.reviewedBy.trim()) {
    throw new Error("Evento de crédito sem revisão completa.");
  }
  assertPrimaryUrl(event.sourceUrl);
}

function emptyResult(ticker: string, observationsUsed: number): DividendStressWindow {
  return {
    ticker,
    status: "no_qualifying_stress",
    baselineMonths: [],
    baselineMedian: null,
    stressMonths: [],
    stressAverage: null,
    stressDropPercent: null,
    stressDetectedAt: null,
    recoveryMonths: [],
    recoveryAverage: null,
    recoveryPercentOfBaseline: null,
    recoveryDetectedAt: null,
    blockingCreditEvent: null,
    observationsUsed,
  };
}

export interface DividendStressWindowOptions {
  stressThreshold?: number;
  recoveryThreshold?: number;
  creditEvents?: VerifiedMaterialCreditEvent[];
}

export class DividendStressWindowEngine {
  detect(
    rawNotices: VerifiedDividendNotice[],
    options: DividendStressWindowOptions = {},
  ): DividendStressWindow {
    if (!Array.isArray(rawNotices) || rawNotices.length === 0) {
      throw new Error("Série de rendimentos verificados vazia.");
    }

    const stressThreshold = options.stressThreshold ?? 0.8;
    const recoveryThreshold = options.recoveryThreshold ?? 0.9;
    if (!(stressThreshold > 0 && stressThreshold < 1)) throw new Error("Limiar de estresse inválido.");
    if (!(recoveryThreshold > stressThreshold && recoveryThreshold <= 1)) {
      throw new Error("Limiar de recuperação inválido.");
    }

    const ticker = rawNotices[0].ticker.trim().toUpperCase();
    if (!/^[A-Z]{4}11$/.test(ticker)) throw new Error(`Ticker inválido: ${ticker}`);

    const notices = [...rawNotices].sort(
      (left, right) => monthIndex(left.competenceMonth) - monthIndex(right.competenceMonth),
    );
    const seenMonths = new Set<string>();
    for (const notice of notices) {
      validateNotice(notice, ticker);
      if (seenMonths.has(notice.competenceMonth)) {
        throw new Error(`Competência duplicada: ${notice.competenceMonth}`);
      }
      seenMonths.add(notice.competenceMonth);
    }

    const creditEvents = [...(options.creditEvents || [])].sort(
      (left, right) => Date.parse(left.knownAt) - Date.parse(right.knownAt),
    );
    creditEvents.forEach((event) => validateCreditEvent(event, ticker));

    if (notices.length < 9) return emptyResult(ticker, notices.length);

    for (let stressEndIndex = 8; stressEndIndex < notices.length; stressEndIndex += 1) {
      const baseline = notices.slice(stressEndIndex - 8, stressEndIndex - 2);
      const stress = notices.slice(stressEndIndex - 2, stressEndIndex + 1);
      const combined = [...baseline, ...stress];
      if (!contiguous(combined)) continue;

      const baselineMedian = median(baseline.map((item) => item.amountPerShare));
      if (baselineMedian <= 0) continue;
      const stressAverage = average(stress.map((item) => item.amountPerShare));
      if (stressAverage - baselineMedian * stressThreshold > COMPARISON_EPSILON) continue;

      const stressDetectedAt = stress.reduce(
        (latest, item) => Date.parse(item.announcedAt) > Date.parse(latest) ? item.announcedAt : latest,
        stress[0].announcedAt,
      );
      const baseResult: DividendStressWindow = {
        ticker,
        status: "stress_without_recovery",
        baselineMonths: baseline.map((item) => item.competenceMonth),
        baselineMedian: round(baselineMedian),
        stressMonths: stress.map((item) => item.competenceMonth),
        stressAverage: round(stressAverage),
        stressDropPercent: round((1 - stressAverage / baselineMedian) * 100, 2),
        stressDetectedAt,
        recoveryMonths: [],
        recoveryAverage: null,
        recoveryPercentOfBaseline: null,
        recoveryDetectedAt: null,
        blockingCreditEvent: null,
        observationsUsed: notices.length,
      };

      for (let recoveryEndIndex = stressEndIndex + 3; recoveryEndIndex < notices.length; recoveryEndIndex += 1) {
        const recovery = notices.slice(recoveryEndIndex - 2, recoveryEndIndex + 1);
        const fullPath = notices.slice(stressEndIndex - 8, recoveryEndIndex + 1);
        if (!contiguous(fullPath) || !contiguous(recovery)) continue;

        const recoveryAverage = average(recovery.map((item) => item.amountPerShare));
        if (baselineMedian * recoveryThreshold - recoveryAverage > COMPARISON_EPSILON) continue;

        const recoveryDetectedAt = recovery.reduce(
          (latest, item) => Date.parse(item.announcedAt) > Date.parse(latest) ? item.announcedAt : latest,
          recovery[0].announcedAt,
        );
        const blockingCreditEvent = creditEvents.find(
          (event) => Date.parse(event.knownAt) <= Date.parse(recoveryDetectedAt),
        ) || null;

        return {
          ...baseResult,
          status: blockingCreditEvent
            ? "recovery_blocked_by_material_credit_event"
            : "reversible_stress_confirmed",
          recoveryMonths: recovery.map((item) => item.competenceMonth),
          recoveryAverage: round(recoveryAverage),
          recoveryPercentOfBaseline: round((recoveryAverage / baselineMedian) * 100, 2),
          recoveryDetectedAt,
          blockingCreditEvent,
        };
      }

      return baseResult;
    }

    return emptyResult(ticker, notices.length);
  }
}

export const dividendStressWindowEngine = new DividendStressWindowEngine();
